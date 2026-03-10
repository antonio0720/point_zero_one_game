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

import type { ThreatEnvelope } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';

export class AnticipationQueue {
  public build(snapshot: RunStateSnapshot): ThreatEnvelope[] {
    const attackThreats = snapshot.battle.pendingAttacks.map((attack) => ({
      threatId: attack.attackId,
      source: attack.source,
      etaTicks: Math.max(1, snapshot.battle.extractionCooldownTicks + 1),
      severity: attack.magnitude,
      visibleAs: 'EXPOSED' as const,
      summary: `${attack.category} inbound from ${attack.source}`,
    }));

    const cascadeThreats = snapshot.cascade.activeChains.flatMap((chain) =>
      chain.links
        .filter((link) => link.scheduledTick >= snapshot.tick)
        .map((link) => ({
          threatId: link.linkId,
          source: chain.templateId,
          etaTicks: Math.max(0, link.scheduledTick - snapshot.tick),
          severity: Math.abs(link.effect.cashDelta ?? 0) + Math.abs(link.effect.shieldDelta ?? 0) + Math.abs(link.effect.heatDelta ?? 0),
          visibleAs: 'EXPOSED' as const,
          summary: link.summary,
        })),
    );

    return [...attackThreats, ...cascadeThreats].sort((left, right) => left.etaTicks - right.etaTicks || right.severity - left.severity);
  }
}
