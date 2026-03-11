/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION UX BRIDGE
 * /backend/src/game/engine/tension/TensionUXBridge.ts
 * ====================================================================== */

import type { EventBus } from '../core/EventBus';
import {
  TENSION_EVENT_NAMES,
  type AnticipationEntry,
  type AnticipationQueueUpdatedEvent,
  type TensionPulseFiredEvent,
  type TensionRuntimeSnapshot,
  type TensionScoreUpdatedEvent,
  type TensionVisibilityChangedEvent,
  type ThreatArrivedEvent,
  type ThreatExpiredEvent,
  type ThreatMitigatedEvent,
  type TensionVisibilityState,
} from './types';

type UnsafeEventBus = EventBus<Record<string, unknown>>;

export class TensionUXBridge {
  private readonly bus: UnsafeEventBus;

  public constructor(bus: EventBus<unknown>) {
    this.bus = bus as unknown as UnsafeEventBus;
  }

  public emitScoreUpdated(snapshot: TensionRuntimeSnapshot): void {
    const detailed: TensionScoreUpdatedEvent = {
      eventType: 'TENSION_SCORE_UPDATED',
      score: snapshot.score,
      previousScore: snapshot.previousScore,
      rawDelta: snapshot.rawDelta,
      amplifiedDelta: snapshot.amplifiedDelta,
      visibilityState: snapshot.visibilityState,
      queueLength: snapshot.queueLength,
      arrivedCount: snapshot.arrivedCount,
      queuedCount: snapshot.queuedCount,
      expiredCount: snapshot.expiredCount,
      dominantEntryId: snapshot.dominantEntryId,
      tickNumber: snapshot.tickNumber,
      timestamp: snapshot.timestamp,
    };

    this.bus.emit(TENSION_EVENT_NAMES.UPDATED_LEGACY, {
      score: snapshot.score,
      visibleThreats: snapshot.visibleThreats.length,
      visibilityState: snapshot.visibilityState,
      pulseActive: snapshot.isPulseActive,
      dominantEntryId: snapshot.dominantEntryId,
    });

    this.bus.emit(TENSION_EVENT_NAMES.SCORE_UPDATED, detailed, {
      emittedAtTick: snapshot.tickNumber,
      tags: ['tension', 'score'],
    });
  }

  public emitVisibilityChanged(
    from: TensionVisibilityState,
    to: TensionVisibilityState,
    tickNumber: number,
  ): void {
    const payload: TensionVisibilityChangedEvent = {
      eventType: 'TENSION_VISIBILITY_CHANGED',
      from,
      to,
      tickNumber,
      timestamp: Date.now(),
    };

    this.bus.emit(TENSION_EVENT_NAMES.VISIBILITY_CHANGED, payload, {
      emittedAtTick: tickNumber,
      tags: ['tension', 'visibility'],
    });
  }

  public emitPulseFired(snapshot: TensionRuntimeSnapshot): void {
    const payload: TensionPulseFiredEvent = {
      eventType: 'TENSION_PULSE_FIRED',
      score: snapshot.score,
      queueLength: snapshot.queueLength,
      pulseTicksActive: snapshot.pulseTicksActive,
      tickNumber: snapshot.tickNumber,
      timestamp: snapshot.timestamp,
    };

    this.bus.emit(TENSION_EVENT_NAMES.PULSE_FIRED, payload, {
      emittedAtTick: snapshot.tickNumber,
      tags: ['tension', 'pulse'],
    });
  }

  public emitThreatArrived(entry: AnticipationEntry, tickNumber: number): void {
    const payload: ThreatArrivedEvent = {
      eventType: 'THREAT_ARRIVED',
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      source: entry.source,
      worstCaseOutcome: entry.worstCaseOutcome,
      mitigationCardTypes: entry.mitigationCardTypes,
      tickNumber,
      timestamp: Date.now(),
    };

    this.bus.emit(TENSION_EVENT_NAMES.THREAT_ARRIVED, payload, {
      emittedAtTick: tickNumber,
      tags: ['tension', 'arrival'],
    });
  }

  public emitThreatMitigated(entry: AnticipationEntry, tickNumber: number): void {
    const payload: ThreatMitigatedEvent = {
      eventType: 'THREAT_MITIGATED',
      entryId: entry.entryId,
      threatType: entry.threatType,
      tickNumber,
      timestamp: Date.now(),
    };

    this.bus.emit(TENSION_EVENT_NAMES.THREAT_MITIGATED, payload, {
      emittedAtTick: tickNumber,
      tags: ['tension', 'mitigation'],
    });
  }

  public emitThreatExpired(entry: AnticipationEntry, tickNumber: number): void {
    const payload: ThreatExpiredEvent = {
      eventType: 'THREAT_EXPIRED',
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      ticksOverdue: entry.ticksOverdue,
      tickNumber,
      timestamp: Date.now(),
    };

    this.bus.emit(TENSION_EVENT_NAMES.THREAT_EXPIRED, payload, {
      emittedAtTick: tickNumber,
      tags: ['tension', 'expiry'],
    });
  }

  public emitQueueUpdated(
    queueLength: number,
    arrivedCount: number,
    queuedCount: number,
    expiredCount: number,
    tickNumber: number,
  ): void {
    const payload: AnticipationQueueUpdatedEvent = {
      eventType: 'ANTICIPATION_QUEUE_UPDATED',
      queueLength,
      arrivedCount,
      queuedCount,
      expiredCount,
      tickNumber,
      timestamp: Date.now(),
    };

    this.bus.emit(TENSION_EVENT_NAMES.QUEUE_UPDATED, payload, {
      emittedAtTick: tickNumber,
      tags: ['tension', 'queue'],
    });
  }
}