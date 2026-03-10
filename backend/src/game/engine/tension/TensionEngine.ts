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

import type { EngineHealth, SimulationEngine, TickContext } from '../core/EngineContracts';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { AnticipationQueue } from './AnticipationQueue';
import { ThreatVisibilityManager } from './ThreatVisibilityManager';

export class TensionEngine implements SimulationEngine {
  public readonly engineId = 'tension' as const;
  private readonly queue = new AnticipationQueue();
  private readonly visibility = new ThreatVisibilityManager();

  public reset(): void {}

  public tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    const threats = this.visibility.apply(this.queue.build(snapshot), snapshot.pressure.tier, snapshot.modeState.counterIntelTier);
    const rawScore = threats.reduce((sum, threat) => sum + Math.max(1, threat.severity / Math.max(1, threat.etaTicks + 1)), 0);
    const score = Math.min(100, Math.round((snapshot.tension.score * 0.65) + rawScore));
    const maxPulseTriggered = score >= 90;
    context.bus.emit('tension.updated', { score, visibleThreats: threats.length });

    return {
      ...snapshot,
      tension: {
        score,
        anticipation: threats.length,
        visibleThreats: threats,
        maxPulseTriggered,
      },
    };
  }

  public getHealth(): EngineHealth {
    return { engineId: this.engineId, status: 'HEALTHY', updatedAt: Date.now() };
  }
}
