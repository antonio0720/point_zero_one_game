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

import type { ModeCode, Targeting } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { EngineOrchestrator } from './EngineOrchestrator';

export class RunLifecycleCoordinator {
  private readonly orchestrator = new EngineOrchestrator();

  public start(userId: string, mode: ModeCode, seed?: string): RunStateSnapshot {
    return this.orchestrator.startRun({ userId, mode, seed });
  }

  public play(definitionId: string, actorId: string, targeting: Targeting = 'SELF'): RunStateSnapshot {
    return this.orchestrator.playCard(definitionId, actorId, targeting);
  }

  public tick(count = 1): RunStateSnapshot {
    let snapshot = this.orchestrator.getSnapshot();
    for (let index = 0; index < count; index += 1) {
      snapshot = this.orchestrator.advanceTick();
      if (snapshot.outcome !== null) {
        break;
      }
    }
    return snapshot;
  }

  public runUntilDone(maxTicks = 500): RunStateSnapshot {
    let snapshot = this.orchestrator.getSnapshot();
    for (let index = 0; index < maxTicks; index += 1) {
      snapshot = this.orchestrator.advanceTick();
      if (snapshot.outcome !== null) {
        return snapshot;
      }
    }
    return snapshot;
  }
}
