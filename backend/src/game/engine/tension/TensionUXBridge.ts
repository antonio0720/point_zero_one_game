/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION UX BRIDGE
 * /backend/src/game/engine/tension/TensionUXBridge.ts
 * ====================================================================== */

import type { EventBus } from '../core/EventBus';

import {
  TENSION_EVENT_NAMES,
  type AnticipationEntry,
  type AnticipationQueueUpdatedEvent,
  type ThreatArrivedEvent,
  type ThreatExpiredEvent,
  type ThreatMitigatedEvent,
  type TensionPulseFiredEvent,
  type TensionRuntimeSnapshot,
  type TensionScoreUpdatedEvent,
  type TensionVisibilityChangedEvent,
  type TensionVisibilityState,
} from './types';

type LooseEventBus = EventBus<Record<string, unknown>>;

export class TensionUXBridge {
  public constructor(private readonly eventBus: LooseEventBus) {}

  public emitScoreUpdated(snapshot: TensionRuntimeSnapshot): void {
    const event: TensionScoreUpdatedEvent = {
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

    this.eventBus.emit(TENSION_EVENT_NAMES.SCORE_UPDATED, event, {
      emittedAtTick: snapshot.tickNumber,
    });

    this.eventBus.emit(TENSION_EVENT_NAMES.UPDATED_LEGACY, snapshot, {
      emittedAtTick: snapshot.tickNumber,
    });
  }

  public emitVisibilityChanged(
    from: TensionVisibilityState,
    to: TensionVisibilityState,
    tickNumber: number,
    timestamp = Date.now(),
  ): void {
    const event: TensionVisibilityChangedEvent = {
      eventType: 'TENSION_VISIBILITY_CHANGED',
      from,
      to,
      tickNumber,
      timestamp,
    };

    this.eventBus.emit(TENSION_EVENT_NAMES.VISIBILITY_CHANGED, event, {
      emittedAtTick: tickNumber,
    });
  }

  public emitPulseFired(snapshot: TensionRuntimeSnapshot): void {
    const event: TensionPulseFiredEvent = {
      eventType: 'TENSION_PULSE_FIRED',
      score: snapshot.score,
      queueLength: snapshot.queueLength,
      pulseTicksActive: snapshot.pulseTicksActive,
      tickNumber: snapshot.tickNumber,
      timestamp: snapshot.timestamp,
    };

    this.eventBus.emit(TENSION_EVENT_NAMES.PULSE_FIRED, event, {
      emittedAtTick: snapshot.tickNumber,
    });
  }

  public emitThreatArrived(entry: AnticipationEntry, tickNumber: number): void {
    const event: ThreatArrivedEvent = {
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

    this.eventBus.emit(TENSION_EVENT_NAMES.THREAT_ARRIVED, event, {
      emittedAtTick: tickNumber,
    });
  }

  public emitThreatMitigated(entry: AnticipationEntry, tickNumber: number): void {
    const event: ThreatMitigatedEvent = {
      eventType: 'THREAT_MITIGATED',
      entryId: entry.entryId,
      threatType: entry.threatType,
      tickNumber,
      timestamp: Date.now(),
    };

    this.eventBus.emit(TENSION_EVENT_NAMES.THREAT_MITIGATED, event, {
      emittedAtTick: tickNumber,
    });
  }

  public emitThreatExpired(entry: AnticipationEntry, tickNumber: number): void {
    const event: ThreatExpiredEvent = {
      eventType: 'THREAT_EXPIRED',
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      ticksOverdue: entry.ticksOverdue,
      tickNumber,
      timestamp: Date.now(),
    };

    this.eventBus.emit(TENSION_EVENT_NAMES.THREAT_EXPIRED, event, {
      emittedAtTick: tickNumber,
    });
  }

  public emitQueueUpdated(
    queueLength: number,
    arrivedCount: number,
    queuedCount: number,
    expiredCount: number,
    tickNumber: number,
  ): void {
    const event: AnticipationQueueUpdatedEvent = {
      eventType: 'ANTICIPATION_QUEUE_UPDATED',
      queueLength,
      arrivedCount,
      queuedCount,
      expiredCount,
      tickNumber,
      timestamp: Date.now(),
    };

    this.eventBus.emit(TENSION_EVENT_NAMES.QUEUE_UPDATED, event, {
      emittedAtTick: tickNumber,
    });
  }
}