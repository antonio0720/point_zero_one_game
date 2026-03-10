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

import type { ThreatEnvelope, VisibilityLevel } from '../core/GamePrimitives';
import { VISIBILITY_BY_TIER } from './types';

export class ThreatVisibilityManager {
  public apply(threats: ThreatEnvelope[], tier: keyof typeof VISIBILITY_BY_TIER, counterIntelTier: number): ThreatEnvelope[] {
    const base = VISIBILITY_BY_TIER[tier];
    return threats.map((threat) => ({
      ...threat,
      visibleAs: this.maxVisibility(base, counterIntelTier >= 3 ? 'EXPOSED' : counterIntelTier === 2 ? 'PARTIAL' : 'SILHOUETTE'),
    }));
  }

  private maxVisibility(left: VisibilityLevel, right: VisibilityLevel): VisibilityLevel {
    const rank: Record<VisibilityLevel, number> = { HIDDEN: 0, SILHOUETTE: 1, PARTIAL: 2, EXPOSED: 3 };
    return rank[left] >= rank[right] ? left : right;
  }
}
