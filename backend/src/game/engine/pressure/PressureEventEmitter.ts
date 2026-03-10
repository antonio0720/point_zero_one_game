/*
 * POINT ZERO ONE — BACKEND PRESSURE EVENT EMITTER
 * /backend/src/game/engine/pressure/PressureEventEmitter.ts
 *
 * Doctrine:
 * - pressure.changed remains the backward-compatible public bus event
 * - richer semantics are returned as EngineSignal diagnostics
 * - CRITICAL entry should be memorable and fire once per run
 * - band changes matter even when the cadence tier does not
 * - this emitter depends on a narrow event-port contract, not a specific
 *   EventBus<T> instantiation, to avoid generic invariance collisions
 */

import {
  createEngineSignal,
  type EngineSignal,
} from '../core/EngineContracts';
import type { EmitOptions } from '../core/EventBus';
import type { EngineEventMap, PressureTier } from '../core/GamePrimitives';
import type { PressureBand, PressureState } from '../core/RunStateSnapshot';

export interface PressureEmissionMeta {
  readonly tick: number;
  readonly dominantSignals?: readonly string[];
  readonly scoreDelta?: number;
}

export interface PressureEmissionResult {
  readonly emittedBusEvents: number;
  readonly signals: readonly EngineSignal[];
}

/**
 * Narrow structural port for the only outward compatibility event this
 * module must publish on the runtime bus.
 *
 * Important:
 * - do not bind this emitter to EventBus<EngineEventMap>
 * - TickContext.bus is typed with a wider event map in the engine contracts
 * - structural emit compatibility is what we need here
 */
export interface PressureEventBusPort {
  emit(
    event: 'pressure.changed',
    payload: EngineEventMap['pressure.changed'],
    options?: EmitOptions,
  ): unknown;
}

export class PressureEventEmitter {
  private criticalEntered = false;

  public reset(): void {
    this.criticalEntered = false;
  }

  public emit(
    bus: PressureEventBusPort,
    previous: PressureState,
    next: PressureState,
    meta: PressureEmissionMeta,
  ): PressureEmissionResult {
    const signals: EngineSignal[] = [];
    let emittedBusEvents = 0;

    const dominantTags = (meta.dominantSignals ?? []).map(
      (value) => `driver:${value}`,
    );

    if (previous.tier !== next.tier) {
      bus.emit(
        'pressure.changed',
        {
          from: previous.tier,
          to: next.tier,
          score: next.score,
        },
        {
          emittedAtTick: meta.tick,
          tags: dominantTags,
        },
      );
      emittedBusEvents += 1;

      signals.push(
        createEngineSignal(
          'pressure',
          this.severityForTier(next.tier),
          this.rankTier(next.tier) > this.rankTier(previous.tier)
            ? 'PRESSURE_TIER_ESCALATED'
            : 'PRESSURE_TIER_DEESCALATED',
          `Pressure tier changed ${previous.tier} → ${next.tier} at ${next.score.toFixed(3)}.`,
          meta.tick,
          [
            `from:${previous.tier}`,
            `to:${next.tier}`,
            `band:${next.band}`,
            ...(meta.scoreDelta !== undefined
              ? [`delta:${meta.scoreDelta.toFixed(3)}`]
              : []),
            ...dominantTags,
          ],
        ),
      );
    }

    if (previous.band !== next.band) {
      signals.push(
        createEngineSignal(
          'pressure',
          this.severityForBand(next.band),
          this.rankBand(next.band) > this.rankBand(previous.band)
            ? 'PRESSURE_BAND_ESCALATED'
            : 'PRESSURE_BAND_DEESCALATED',
          `Pressure band changed ${previous.band} → ${next.band} at ${next.score.toFixed(3)}.`,
          meta.tick,
          [
            `tier:${next.tier}`,
            ...(meta.scoreDelta !== undefined
              ? [`delta:${meta.scoreDelta.toFixed(3)}`]
              : []),
            ...dominantTags,
          ],
        ),
      );
    }

    if (next.tier === 'T4' && !this.criticalEntered) {
      this.criticalEntered = true;

      signals.push(
        createEngineSignal(
          'pressure',
          'ERROR',
          'PRESSURE_CRITICAL_ENTERED',
          `Pressure entered CRITICAL at ${next.score.toFixed(3)}.`,
          meta.tick,
          [
            `band:${next.band}`,
            ...(meta.scoreDelta !== undefined
              ? [`delta:${meta.scoreDelta.toFixed(3)}`]
              : []),
            ...dominantTags,
          ],
        ),
      );
    }

    if (previous.tier === 'T4' && next.tier !== 'T4') {
      signals.push(
        createEngineSignal(
          'pressure',
          'INFO',
          'PRESSURE_CRITICAL_EXITED',
          `Pressure exited CRITICAL and moved to ${next.tier} at ${next.score.toFixed(3)}.`,
          meta.tick,
          [
            `band:${next.band}`,
            ...(meta.scoreDelta !== undefined
              ? [`delta:${meta.scoreDelta.toFixed(3)}`]
              : []),
            ...dominantTags,
          ],
        ),
      );
    }

    return {
      emittedBusEvents,
      signals,
    };
  }

  private severityForTier(tier: PressureTier): 'INFO' | 'WARN' | 'ERROR' {
    switch (tier) {
      case 'T4':
        return 'ERROR';
      case 'T3':
      case 'T2':
        return 'WARN';
      case 'T1':
      case 'T0':
      default:
        return 'INFO';
    }
  }

  private severityForBand(band: PressureBand): 'INFO' | 'WARN' | 'ERROR' {
    switch (band) {
      case 'CRITICAL':
        return 'ERROR';
      case 'HIGH':
      case 'ELEVATED':
        return 'WARN';
      case 'BUILDING':
      case 'CALM':
      default:
        return 'INFO';
    }
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