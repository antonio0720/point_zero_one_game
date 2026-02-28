/**
 * FILE: pzo-web/src/engines/tension/TensionUXBridge.ts
 * Wraps ALL EventBus.emit() calls from the Tension Engine.
 * Called by TensionEngine. Does NOT calculate anything.
 * All tension events that the frontend and audio system consume originate here.
 *
 * RULE: Zero calculation logic. Only eventBus.emit() calls.
 * IMPORTS: types.ts, EventBus, PZOEventChannel only. Never imports any engine class.
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 */
import type {
  TensionSnapshot,
  VisibilityState,
  ThreatType,
  AnticipationEntry,
  TensionScoreUpdatedEvent,
  TensionVisibilityChangedEvent,
  TensionPulseFiredEvent,
  ThreatArrivedEvent,
  ThreatMitigatedEvent,
  ThreatExpiredEvent,
  AnticipationQueueUpdatedEvent,
} from './types';
import { EventBus, PZOEventChannel } from '../core/EventBus';

export class TensionUXBridge {
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ── Score & Pulse ──────────────────────────────────────────────────────

  /** Fires every tick — primary score update for store listeners and gauge components. */
  public emitScoreUpdated(snapshot: TensionSnapshot): void {
    const evt: TensionScoreUpdatedEvent = {
      eventType: 'TENSION_SCORE_UPDATED',
      score: snapshot.score,
      visibilityState: snapshot.visibilityState,
      tickNumber: snapshot.tickNumber,
      timestamp: snapshot.timestamp,
    };
    this.eventBus.emit(PZOEventChannel.TENSION_SCORE_UPDATED, evt);
  }

  /**
   * Fires when score >= PULSE_THRESHOLD (0.90).
   * IMPORTANT: UI/audio signal only. No game state changes. No mechanical consequences.
   */
  public emitPulseFired(snapshot: TensionSnapshot): void {
    const evt: TensionPulseFiredEvent = {
      eventType: 'TENSION_PULSE_FIRED',
      score: snapshot.score,
      queueLength: snapshot.queueLength,
      pulseTicksActive: snapshot.pulseTicksActive,
      tickNumber: snapshot.tickNumber,
      timestamp: snapshot.timestamp,
    };
    this.eventBus.emit(PZOEventChannel.TENSION_PULSE_FIRED, evt);
  }

  // ── Visibility ─────────────────────────────────────────────────────────

  /** Fires when visibility state transitions between levels. */
  public emitVisibilityChanged(
    from: VisibilityState,
    to: VisibilityState,
    tickNumber: number
  ): void {
    const evt: TensionVisibilityChangedEvent = {
      eventType: 'TENSION_VISIBILITY_CHANGED',
      from,
      to,
      tickNumber,
      timestamp: Date.now(),
    };
    this.eventBus.emit(PZOEventChannel.TENSION_VISIBILITY_CHANGED, evt);
  }

  // ── Threat Lifecycle ───────────────────────────────────────────────────

  /** Fires when a queued threat transitions to ARRIVED. */
  public emitThreatArrived(entry: AnticipationEntry, tickNumber: number): void {
    const evt: ThreatArrivedEvent = {
      eventType: 'THREAT_ARRIVED',
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      worstCaseOutcome: entry.worstCaseOutcome,
      mitigationCardTypes: entry.mitigationCardTypes,
      tickNumber,
      timestamp: Date.now(),
    };
    this.eventBus.emit(PZOEventChannel.THREAT_ARRIVED, evt);
  }

  /** Fires when a player successfully mitigates an arrived threat. */
  public emitThreatMitigated(
    entryId: string,
    threatType: ThreatType,
    tickNumber: number
  ): void {
    const evt: ThreatMitigatedEvent = {
      eventType: 'THREAT_MITIGATED',
      entryId,
      threatType,
      tickNumber,
      timestamp: Date.now(),
    };
    this.eventBus.emit(PZOEventChannel.THREAT_MITIGATED, evt);
  }

  /** Fires when a threat expires without player mitigation. */
  public emitThreatExpired(entry: AnticipationEntry, tickNumber: number): void {
    const evt: ThreatExpiredEvent = {
      eventType: 'THREAT_EXPIRED',
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      ticksOverdue: entry.ticksOverdue,
      tickNumber,
      timestamp: Date.now(),
    };
    this.eventBus.emit(PZOEventChannel.THREAT_EXPIRED, evt);
  }

  // ── Queue State ────────────────────────────────────────────────────────

  /** Fires any time queue length changes (enqueue, mitigation, expiry, nullification). */
  public emitQueueUpdated(
    queueLength: number,
    arrivedCount: number,
    tickNumber: number
  ): void {
    const evt: AnticipationQueueUpdatedEvent = {
      eventType: 'ANTICIPATION_QUEUE_UPDATED',
      queueLength,
      arrivedCount,
      tickNumber,
      timestamp: Date.now(),
    };
    this.eventBus.emit(PZOEventChannel.ANTICIPATION_QUEUE_UPDATED, evt);
  }
}