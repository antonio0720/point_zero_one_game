/*
 * POINT ZERO ONE — BACKEND SHIELD UX BRIDGE
 * /backend/src/game/engine/shield/ShieldUXBridge.ts
 *
 * Doctrine:
 * - bus-owned shield emits live here
 * - richer shield diagnostics that do not fit EngineEventMap are returned
 *   as EngineSignal values, not ad-hoc untyped bus events
 * - this bridge keeps ShieldEngine orchestration lean and readable
 */

import {
  createEngineSignal,
  type EngineSignal,
} from '../core/EngineContracts';
import type { EventBus } from '../core/EventBus';
import type {
  EngineEventMap,
  ShieldLayerId,
} from '../core/GamePrimitives';
import type { ShieldLayerState } from '../core/RunStateSnapshot';
import {
  getLayerConfig,
  SHIELD_CONSTANTS,
  type QueueRejection,
  type RepairLayerId,
} from './types';

export class ShieldUXBridge {
  public emitLayerBreached(
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
    payload: {
      readonly attackId: string;
      readonly layerId: ShieldLayerId;
      readonly tick: number;
      readonly cascadesTriggered: number;
    },
  ): void {
    bus.emit('shield.breached', {
      attackId: payload.attackId,
      layerId: payload.layerId,
      tick: payload.tick,
      cascadesTriggered: payload.cascadesTriggered,
    });
  }

  public buildTransitionSignals(
    previousLayers: readonly ShieldLayerState[],
    nextLayers: readonly ShieldLayerState[],
    tick: number,
  ): readonly EngineSignal[] {
    const previousById = new Map(
      previousLayers.map((layer) => [layer.layerId, layer]),
    );

    const signals: EngineSignal[] = [];

    for (const next of nextLayers) {
      const previous = previousById.get(next.layerId);
      if (previous === undefined) {
        continue;
      }

      const layerName = getLayerConfig(next.layerId).doctrineName;

      const newlyBreached = previous.current > 0 && next.current === 0;
      if (newlyBreached) {
        continue;
      }

      const crossedCritical =
        previous.integrityRatio >= SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD &&
        next.integrityRatio < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD &&
        next.current > 0;

      const crossedLow =
        previous.integrityRatio >= SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD &&
        next.integrityRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD &&
        next.current > 0;

      if (crossedCritical) {
        signals.push(
          createEngineSignal(
            'shield',
            'WARN',
            'SHIELD_LAYER_CRITICAL',
            `${layerName} dropped below critical threshold.`,
            tick,
            [`layer:${next.layerId}`, `ratio:${next.integrityRatio.toFixed(3)}`],
          ),
        );
      } else if (crossedLow) {
        signals.push(
          createEngineSignal(
            'shield',
            'WARN',
            'SHIELD_LAYER_LOW',
            `${layerName} dropped below low-integrity threshold.`,
            tick,
            [`layer:${next.layerId}`, `ratio:${next.integrityRatio.toFixed(3)}`],
          ),
        );
      }

      const restoredFromBreach = previous.breached && !next.breached;
      if (restoredFromBreach) {
        signals.push(
          createEngineSignal(
            'shield',
            'INFO',
            'SHIELD_LAYER_RESTORED',
            `${layerName} was restored from breach.`,
            tick,
            [`layer:${next.layerId}`, `current:${String(next.current)}`],
          ),
        );
      }

      const fullyRepaired = previous.current < previous.max && next.current === next.max;
      if (fullyRepaired) {
        signals.push(
          createEngineSignal(
            'shield',
            'INFO',
            'SHIELD_LAYER_FULLY_REPAIRED',
            `${layerName} returned to full integrity.`,
            tick,
            [`layer:${next.layerId}`],
          ),
        );
      }
    }

    return Object.freeze(signals);
  }

  public buildFortifiedSignals(
    wasFortified: boolean,
    isFortified: boolean,
    tick: number,
  ): readonly EngineSignal[] {
    if (!wasFortified && isFortified) {
      return Object.freeze([
        createEngineSignal(
          'shield',
          'INFO',
          'SHIELD_FORTIFIED_ENTERED',
          'All shield layers are fortified above the integrity threshold.',
          tick,
        ),
      ]);
    }

    if (wasFortified && !isFortified) {
      return Object.freeze([
        createEngineSignal(
          'shield',
          'WARN',
          'SHIELD_FORTIFIED_LOST',
          'Fortified shield state was lost.',
          tick,
        ),
      ]);
    }

    return Object.freeze([]);
  }

  public buildCascadeSignal(
    templateId: string,
    chainId: string,
    tick: number,
  ): EngineSignal {
    return createEngineSignal(
      'shield',
      'ERROR',
      'SHIELD_CASCADE_TRIGGERED',
      `Network core breach triggered cascade template ${templateId}.`,
      tick,
      [`chain:${chainId}`, `template:${templateId}`],
    );
  }

  public buildQueueRejectionSignals(
    rejections: readonly QueueRejection[],
  ): readonly EngineSignal[] {
    return Object.freeze(
      rejections.map((rejection) =>
        createEngineSignal(
          'shield',
          'WARN',
          'SHIELD_REPAIR_QUEUE_FULL',
          `Repair queue rejected ${rejection.amount} point(s) for ${this.describeLayer(rejection.layerId)}.`,
          rejection.tick,
          [
            `layer:${rejection.layerId}`,
            `amount:${String(rejection.amount)}`,
            `duration:${String(rejection.durationTicks)}`,
            `source:${rejection.source}`,
          ],
        ),
      ),
    );
  }

  private describeLayer(layerId: RepairLayerId): string {
    if (layerId === 'ALL') {
      return 'ALL';
    }

    return getLayerConfig(layerId).doctrineName;
  }
}