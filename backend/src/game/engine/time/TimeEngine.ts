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
import { PHASE_BOUNDARIES_MS } from './types';
import { TickRateInterpolator } from './TickRateInterpolator';
import { DecisionTimer } from './DecisionTimer';

export class TimeEngine implements SimulationEngine {
  public readonly engineId = 'time' as const;
  private readonly interpolator = new TickRateInterpolator();
  private readonly decisionTimer = new DecisionTimer();

  public reset(): void {
    this.decisionTimer.reset();
  }

  public tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    const durationMs = this.interpolator.resolveDurationMs(snapshot.pressure.tier);
    const elapsedMs = snapshot.timers.elapsedMs + durationMs;
    const phase = this.resolvePhase(elapsedMs);
    const previousPhase = snapshot.phase;
    const phaseBoundaryWindowsRemaining = phase !== previousPhase ? 5 : Math.max(0, snapshot.modeState.phaseBoundaryWindowsRemaining - 1);
    const expiredWindows = this.decisionTimer.closeExpired(context.nowMs);

    return {
      ...snapshot,
      tick: snapshot.tick + 1,
      phase,
      modeState: {
        ...snapshot.modeState,
        phaseBoundaryWindowsRemaining,
      },
      timers: {
        ...snapshot.timers,
        elapsedMs,
        currentTickDurationMs: durationMs,
        activeDecisionWindows: this.decisionTimer.snapshot(),
        frozenWindowIds: this.decisionTimer.frozenIds(),
      },
      tags: expiredWindows.length > 0 ? [...snapshot.tags, 'decision_window:expired'] : snapshot.tags,
    };
  }

  public getHealth(): EngineHealth {
    return { engineId: this.engineId, status: 'HEALTHY', updatedAt: Date.now() };
  }

  private resolvePhase(elapsedMs: number): RunStateSnapshot['phase'] {
    let current = PHASE_BOUNDARIES_MS[0].phase;
    for (const boundary of PHASE_BOUNDARIES_MS) {
      if (elapsedMs >= boundary.startsAtMs) {
        current = boundary.phase;
      }
    }
    return current;
  }
}
