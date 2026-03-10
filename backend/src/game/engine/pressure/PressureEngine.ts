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
import type { PressureTier } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { PRESSURE_THRESHOLDS } from './types';
import { PressureSignalCollector } from './PressureSignalCollector';
import { PressureDecayController } from './PressureDecayController';
import { PressureEventEmitter } from './PressureEventEmitter';

export class PressureEngine implements SimulationEngine {
  public readonly engineId = 'pressure' as const;
  private readonly collector = new PressureSignalCollector();
  private readonly decay = new PressureDecayController();
  private readonly emitter = new PressureEventEmitter();

  public reset(): void {}

  public tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    const rawScore = this.collector.collect(snapshot);
    const score = this.decay.apply(snapshot.pressure.score, rawScore);
    const tier = this.resolveTier(score);
    this.emitter.emit(context.bus, snapshot.pressure.tier, tier, score);

    return {
      ...snapshot,
      pressure: {
        score,
        tier,
        previousTier: snapshot.pressure.tier,
        upwardCrossings: snapshot.pressure.upwardCrossings + (this.rank(tier) > this.rank(snapshot.pressure.tier) ? 1 : 0),
        survivedHighPressureTicks: snapshot.pressure.survivedHighPressureTicks + (tier === 'T3' || tier === 'T4' ? 1 : 0),
      },
    };
  }

  public getHealth(): EngineHealth {
    return { engineId: this.engineId, status: 'HEALTHY', updatedAt: Date.now() };
  }

  private resolveTier(score: number): PressureTier {
    return PRESSURE_THRESHOLDS.find((entry) => score >= entry.minScore)?.tier ?? 'T0';
  }

  private rank(tier: PressureTier): number {
    return ['T0', 'T1', 'T2', 'T3', 'T4'].indexOf(tier);
  }
}
