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

import type { EventBus } from '../core/EventBus';
import type { EngineHealth, SimulationEngine, TickContext } from '../core/EngineContracts';
import type { EngineEventMap } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { ReplayIntegrityChecker } from './ReplayIntegrityChecker';
import { ProofGenerator } from './ProofGenerator';
import { RunGradeAssigner } from './RunGradeAssigner';
import { checksumSnapshot } from '../core/Deterministic';

export class SovereigntyEngine implements SimulationEngine {
  public readonly engineId = 'sovereignty' as const;
  private readonly integrity = new ReplayIntegrityChecker();
  private readonly proof = new ProofGenerator();
  private readonly grader = new RunGradeAssigner();

  public reset(): void {}

  public tick(snapshot: RunStateSnapshot, _context: TickContext): RunStateSnapshot {
    return {
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        gapClosingRate: snapshot.mode === 'ghost' ? Number((snapshot.sovereignty.gapVsLegend / Math.max(1, snapshot.tick)).toFixed(4)) : 0,
      },
    };
  }

  public finalizeRun(snapshot: RunStateSnapshot, bus: EventBus<EngineEventMap>, nowMs: number): RunStateSnapshot {
    const integrity = this.integrity.verify(snapshot);
    const proofHash = this.proof.generate(snapshot);
    const graded = this.grader.score(snapshot);
    const integrityStatus = integrity.ok ? 'VERIFIED' : 'QUARANTINED';

    const finalized: RunStateSnapshot = {
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        integrityStatus,
        proofHash,
        sovereigntyScore: graded.score,
        verifiedGrade: graded.grade,
        proofBadges: graded.badges,
        tickChecksums: [...snapshot.sovereignty.tickChecksums, checksumSnapshot({ finalizedAt: nowMs, proofHash })],
      },
    };

    bus.emit('sovereignty.completed', {
      runId: finalized.runId,
      score: finalized.sovereignty.sovereigntyScore,
      grade: finalized.sovereignty.verifiedGrade ?? 'F',
      proofHash,
      outcome: finalized.outcome ?? 'ABANDONED',
    });

    return finalized;
  }

  public getHealth(): EngineHealth {
    return { engineId: this.engineId, status: 'HEALTHY', updatedAt: Date.now() };
  }
}
