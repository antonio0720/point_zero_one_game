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

export class ReplayIntegrityChecker {
  public verify(snapshot: RunStateSnapshot): { ok: boolean; reason: string | null } {
    if (snapshot.sovereignty.tickChecksums.length === 0) {
      return { ok: false, reason: 'missing tick checksums' };
    }
    if (new Set(snapshot.sovereignty.tickChecksums).size !== snapshot.sovereignty.tickChecksums.length) {
      return { ok: false, reason: 'duplicate checksum chain' };
    }
    if (snapshot.mode === 'ghost' && snapshot.modeState.legendMarkersEnabled && snapshot.cards.ghostMarkers.length === 0) {
      return { ok: false, reason: 'ghost mode missing legend markers' };
    }
    return { ok: true, reason: null };
  }
}
