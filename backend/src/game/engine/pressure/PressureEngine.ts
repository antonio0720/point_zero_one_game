/*
 * POINT ZERO ONE — BACKEND PRESSURE ENGINE
 * /backend/src/game/engine/pressure/PressureEngine.ts
 *
 * Doctrine:
 * - backend pressure is authoritative and deterministic
 * - pressure.score is normalized 0.0 → 1.0
 * - pressure.tier preserves cadence semantics used elsewhere in the engine graph
 * - pressure.band carries the richer semantic layer needed by dossiers, UI, and ML
 */

import {
  createEngineHealth,
  type EngineHealth,
  type SimulationEngine,
  type TickContext,
} from '../core/EngineContracts';
import type { PressureTier } from '../core/GamePrimitives';
import type {
  PressureBand,
  PressureState,
  RunStateSnapshot,
} from '../core/RunStateSnapshot';
import { PressureDecayController } from './PressureDecayController';
import { PressureEventEmitter } from './PressureEventEmitter';
import { PressureSignalCollector } from './PressureSignalCollector';
import {
  resolvePressureBand,
  resolvePressureTier,
} from './types';

export class PressureEngine implements SimulationEngine {
  public readonly engineId = 'pressure' as const;

  private readonly collector = new PressureSignalCollector();
  private readonly decay = new PressureDecayController();
  private readonly emitter = new PressureEventEmitter();

  private health: EngineHealth = createEngineHealth(
    this.engineId,
    'HEALTHY',
    Date.now(),
    ['Pressure engine initialized.'],
  );

  public reset(): void {
    this.health = createEngineHealth(
      this.engineId,
      'HEALTHY',
      Date.now(),
      ['Pressure engine reset.'],
    );
  }

  public canRun(snapshot: RunStateSnapshot): boolean {
    return snapshot.outcome === null;
  }

  public tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    const collection = this.collector.collect(snapshot);
    const score = this.decay.apply(snapshot, collection.score);
    const tier = resolvePressureTier(score);
    const band = resolvePressureBand(score);

    const nextPressure = this.buildNextPressureState(snapshot, score, tier, band);

    this.emitter.emit(context.bus, snapshot.pressure, nextPressure);

    this.health = createEngineHealth(
      this.engineId,
      'HEALTHY',
      context.nowMs,
      this.buildHealthNotes(collection),
    );

    return {
      ...snapshot,
      pressure: nextPressure,
    };
  }

  public getHealth(): EngineHealth {
    return this.health;
  }

  private buildNextPressureState(
    snapshot: RunStateSnapshot,
    score: number,
    tier: PressureTier,
    band: PressureBand,
  ): PressureState {
    const tierEscalated = this.rankTier(tier) > this.rankTier(snapshot.pressure.tier);
    const bandEscalated = this.rankBand(band) > this.rankBand(snapshot.pressure.band);

    return {
      score,
      tier,
      band,
      previousTier: snapshot.pressure.tier,
      previousBand: snapshot.pressure.band,
      upwardCrossings:
        snapshot.pressure.upwardCrossings + (tierEscalated ? 1 : 0),
      survivedHighPressureTicks:
        snapshot.pressure.survivedHighPressureTicks + (this.isHighTier(tier) ? 1 : 0),
      lastEscalationTick:
        tierEscalated || bandEscalated
          ? snapshot.tick
          : snapshot.pressure.lastEscalationTick,
      maxScoreSeen: Math.max(snapshot.pressure.maxScoreSeen, score),
    };
  }

  private buildHealthNotes(
    collection: ReturnType<PressureSignalCollector['collect']>,
  ): readonly string[] {
    const top = [...collection.contributions]
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 3)
      .map((entry) => `${entry.key}=${entry.amount.toFixed(3)}`);

    return [
      `pressureScore=${collection.score.toFixed(3)}`,
      ...(top.length > 0 ? top : ['pressureSignals=none']),
    ];
  }

  private isHighTier(tier: PressureTier): boolean {
    return tier === 'T3' || tier === 'T4';
  }

  private rankTier(tier: PressureTier): number {
    switch (tier) {
      case 'T0':
        return 0;
      case 'T1':
        return 1;
      case 'T2':
        return 2;
      case 'T3':
        return 3;
      case 'T4':
        return 4;
      default:
        return -1;
    }
  }

  private rankBand(band: PressureBand): number {
    switch (band) {
      case 'CALM':
        return 0;
      case 'BUILDING':
        return 1;
      case 'ELEVATED':
        return 2;
      case 'HIGH':
        return 3;
      case 'CRITICAL':
        return 4;
      default:
        return -1;
    }
  }
}