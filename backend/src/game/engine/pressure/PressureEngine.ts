/*
 * POINT ZERO ONE — BACKEND PRESSURE ENGINE
 * /backend/src/game/engine/pressure/PressureEngine.ts
 *
 * Doctrine:
 * - backend pressure is authoritative, deterministic, and replay-safe
 * - pressure.score is normalized 0.0 → 1.0
 * - pressure.tier preserves cadence semantics used elsewhere in the engine graph
 * - pressure.band carries richer semantic meaning for UI, ML, and dossiers
 * - backward compatibility with EngineEventMap is preserved through pressure.changed
 * - deeper diagnostics are returned as EngineSignal payloads, not ad-hoc bus events
 */

import {
  createEngineHealth,
  createEngineSignal,
  type EngineHealth,
  type EngineSignal,
  type EngineTickResult,
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
import {
  PressureEventEmitter,
  type PressureEmissionMeta,
} from './PressureEventEmitter';
import { PressureSignalCollector } from './PressureSignalCollector';
import {
  resolvePressureBand,
  resolvePressureTier,
} from './types';

const PRESSURE_HISTORY_DEPTH = 20;
const TOP_SIGNAL_COUNT = 3;
const HIGH_PRESSURE_MILESTONES = new Set<number>([5, 10, 20, 40]);

type PressureCollection = ReturnType<PressureSignalCollector['collect']>;

export class PressureEngine implements SimulationEngine {
  public readonly engineId = 'pressure' as const;

  private readonly collector = new PressureSignalCollector();
  private readonly decay = new PressureDecayController();
  private readonly emitter = new PressureEventEmitter();

  private readonly scoreHistory: number[] = [];
  private readonly rawScoreHistory: number[] = [];
  private readonly dominantSignalHistory: string[] = [];

  private lastCollection: PressureCollection | null = null;

  private health: EngineHealth = createEngineHealth(
    this.engineId,
    'HEALTHY',
    Date.now(),
    ['Pressure engine initialized.'],
  );

  public reset(): void {
    this.scoreHistory.length = 0;
    this.rawScoreHistory.length = 0;
    this.dominantSignalHistory.length = 0;
    this.lastCollection = null;
    this.emitter.reset();

    this.health = createEngineHealth(
      this.engineId,
      'HEALTHY',
      Date.now(),
      ['Pressure engine reset.'],
    );
  }

  public canRun(snapshot: RunStateSnapshot, _context?: TickContext): boolean {
    return snapshot.outcome === null;
  }

  public tick(snapshot: RunStateSnapshot, context: TickContext): EngineTickResult {
    if (!this.canRun(snapshot, context)) {
      return {
        snapshot,
        signals: [
          createEngineSignal(
            this.engineId,
            'INFO',
            'PRESSURE_SKIPPED_TERMINAL_OUTCOME',
            'Pressure engine skipped because run outcome is terminal.',
            snapshot.tick,
            [`outcome:${String(snapshot.outcome)}`],
          ),
        ],
      };
    }

    try {
      const collection = this.collector.collect(snapshot);
      const score = this.decay.apply(snapshot, collection.score);
      const tier = resolvePressureTier(score);
      const band = resolvePressureBand(score);

      const nextPressure = this.buildNextPressureState(
        snapshot,
        score,
        tier,
        band,
      );

      this.recordRuntimeHistory(collection, nextPressure);

      const emissionMeta: PressureEmissionMeta = {
        tick: snapshot.tick,
        dominantSignals: this.extractDominantSignalKeys(collection),
        scoreDelta: Number((nextPressure.score - snapshot.pressure.score).toFixed(6)),
      };

      const emission = this.emitter.emit(
        context.bus,
        snapshot.pressure,
        nextPressure,
        emissionMeta,
      );

      const diagnosticSignals = this.buildDiagnosticSignals(
        snapshot,
        nextPressure,
        collection,
        context,
      );

      const nextSnapshot: RunStateSnapshot = {
        ...snapshot,
        pressure: nextPressure,
      };

      const signals = [...diagnosticSignals, ...emission.signals];

      this.lastCollection = collection;
      this.health = createEngineHealth(
        this.engineId,
        signals.some((signal) => signal.severity === 'ERROR')
          ? 'DEGRADED'
          : 'HEALTHY',
        context.nowMs,
        this.buildHealthNotes(collection, nextPressure),
      );

      return {
        snapshot: nextSnapshot,
        signals,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown pressure engine failure.';

      this.health = createEngineHealth(
        this.engineId,
        'FAILED',
        context.nowMs,
        [message],
      );

      throw error;
    }
  }

  public getHealth(): EngineHealth {
    return this.health;
  }

  public getScoreHistory(): readonly number[] {
    return Object.freeze([...this.scoreHistory]);
  }

  public getRawScoreHistory(): readonly number[] {
    return Object.freeze([...this.rawScoreHistory]);
  }

  public getDominantSignalHistory(): readonly string[] {
    return Object.freeze([...this.dominantSignalHistory]);
  }

  public getLastSignalCollection(): PressureCollection | null {
    return this.lastCollection;
  }

  private buildNextPressureState(
    snapshot: RunStateSnapshot,
    score: number,
    tier: PressureTier,
    band: PressureBand,
  ): PressureState {
    const tierEscalated =
      this.rankTier(tier) > this.rankTier(snapshot.pressure.tier);
    const bandEscalated =
      this.rankBand(band) > this.rankBand(snapshot.pressure.band);

    return {
      score,
      tier,
      band,
      previousTier: snapshot.pressure.tier,
      previousBand: snapshot.pressure.band,
      upwardCrossings:
        snapshot.pressure.upwardCrossings + (tierEscalated ? 1 : 0),
      survivedHighPressureTicks:
        snapshot.pressure.survivedHighPressureTicks +
        (this.isHighTier(tier) ? 1 : 0),
      lastEscalationTick:
        tierEscalated || bandEscalated
          ? snapshot.tick
          : snapshot.pressure.lastEscalationTick,
      maxScoreSeen: Math.max(snapshot.pressure.maxScoreSeen, score),
    };
  }

  private buildDiagnosticSignals(
    snapshot: RunStateSnapshot,
    nextPressure: PressureState,
    collection: PressureCollection,
    context: TickContext,
  ): readonly EngineSignal[] {
    const signals: EngineSignal[] = [];

    const dominantSignals = this.extractDominantSignalKeys(collection);

    if (nextPressure.maxScoreSeen > snapshot.pressure.maxScoreSeen) {
      signals.push(
        createEngineSignal(
          this.engineId,
          this.isHighTier(nextPressure.tier) ? 'WARN' : 'INFO',
          'PRESSURE_NEW_HIGH_WATERMARK',
          `Pressure reached a new high watermark of ${nextPressure.score.toFixed(3)}.`,
          snapshot.tick,
          [
            `trace:${context.trace.traceId}`,
            `tier:${nextPressure.tier}`,
            `band:${nextPressure.band}`,
            ...dominantSignals.map((value) => `driver:${value}`),
          ],
        ),
      );
    }

    if (
      this.isHighTier(nextPressure.tier) &&
      HIGH_PRESSURE_MILESTONES.has(nextPressure.survivedHighPressureTicks)
    ) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'WARN',
          'PRESSURE_HIGH_PERSISTENCE',
          `High pressure has persisted for ${nextPressure.survivedHighPressureTicks} tick(s).`,
          snapshot.tick,
          [
            `tier:${nextPressure.tier}`,
            `band:${nextPressure.band}`,
            ...dominantSignals.map((value) => `driver:${value}`),
          ],
        ),
      );
    }

    const topContribution = [...collection.contributions]
      .sort((left, right) => right.amount - left.amount)[0];

    if (
      topContribution &&
      nextPressure.score >= 0.55 &&
      topContribution.amount >= 0.10
    ) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'WARN',
          'PRESSURE_DOMINANT_DRIVER',
          `${topContribution.key} is the dominant pressure driver at ${topContribution.amount.toFixed(3)} contribution.`,
          snapshot.tick,
          [
            `tier:${nextPressure.tier}`,
            `band:${nextPressure.band}`,
            `delta:${(nextPressure.score - snapshot.pressure.score).toFixed(3)}`,
          ],
        ),
      );
    }

    if (
      nextPressure.score === 0 &&
      collection.contributions.length === 0 &&
      snapshot.pressure.score > 0
    ) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'PRESSURE_FULL_RELIEF',
          'Pressure fully returned to calm with no active contributing signals.',
          snapshot.tick,
          [`trace:${context.trace.traceId}`],
        ),
      );
    }

    return signals;
  }

  private buildHealthNotes(
    collection: PressureCollection,
    nextPressure: PressureState,
  ): readonly string[] {
    const topDrivers = [...collection.contributions]
      .sort((left, right) => right.amount - left.amount)
      .slice(0, TOP_SIGNAL_COUNT)
      .map((entry) => `${entry.key}=${entry.amount.toFixed(3)}`);

    return [
      `score=${nextPressure.score.toFixed(3)}`,
      `raw=${collection.rawScore.toFixed(3)}`,
      `tier=${nextPressure.tier}`,
      `band=${nextPressure.band}`,
      `history=${this.scoreHistory.length}`,
      ...(topDrivers.length > 0
        ? [`drivers=${topDrivers.join(',')}`]
        : ['drivers=none']),
    ];
  }

  private recordRuntimeHistory(
    collection: PressureCollection,
    nextPressure: PressureState,
  ): void {
    this.pushBounded(this.scoreHistory, nextPressure.score, PRESSURE_HISTORY_DEPTH);
    this.pushBounded(this.rawScoreHistory, collection.rawScore, PRESSURE_HISTORY_DEPTH);

    const dominantSignals = this.extractDominantSignalKeys(collection);
    if (dominantSignals.length > 0) {
      this.pushBounded(
        this.dominantSignalHistory,
        dominantSignals[0],
        PRESSURE_HISTORY_DEPTH,
      );
    }
  }

  private extractDominantSignalKeys(
    collection: PressureCollection,
  ): readonly string[] {
    return Object.freeze(
      [...collection.contributions]
        .sort((left, right) => right.amount - left.amount)
        .slice(0, TOP_SIGNAL_COUNT)
        .filter((entry) => entry.amount > 0)
        .map((entry) => entry.key),
    );
  }

  private pushBounded<T>(buffer: T[], value: T, maxDepth: number): void {
    buffer.push(value);
    if (buffer.length > maxDepth) {
      buffer.shift();
    }
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