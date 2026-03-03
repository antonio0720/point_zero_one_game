/**
 * FILE: pzo-web/src/engines/tension/TensionUXBridge.ts
 *
 * Wraps ALL EventBus.emit() calls from the Tension Engine.
 * Called by TensionEngine. Does NOT calculate anything.
 *
 * CANONICAL BUS: zero/EventBus. Imports EventBus from '../zero/EventBus' only.
 * NEVER imports from core/EventBus or uses PZOEventChannel enum.
 *
 * Payload shapes match EngineEventPayloadMap in zero/types.ts exactly.
 * eventType, tickIndex, timestamp are in the EngineEvent ENVELOPE — not the payload.
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 */
import type { TensionSnapshot, VisibilityState, AnticipationEntry } from './types';
import type { EventBus } from '../zero/EventBus';

export class TensionUXBridge {
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ── Score — fires every tick ───────────────────────────────────────────────

  /**
   * Primary score update. Fires every tick.
   * Payload: { score, tickIndex } — matches EngineEventPayloadMap['TENSION_SCORE_UPDATED'].
   */
  public emitScoreUpdated(snapshot: TensionSnapshot): void {
    this.eventBus.emit('TENSION_SCORE_UPDATED', {
      score:     snapshot.score,
      tickIndex: snapshot.tickNumber,
    });
  }

  /**
   * Fires when score >= PULSE_THRESHOLD (0.90).
   * UI/audio signal only — no game state changes, no mechanical consequences.
   * Payload: { tensionScore, queueDepth } — matches EngineEventPayloadMap['ANTICIPATION_PULSE'].
   */
  public emitPulseFired(snapshot: TensionSnapshot): void {
    this.eventBus.emit('ANTICIPATION_PULSE', {
      tensionScore: snapshot.score,
      queueDepth:   snapshot.queueLength,
    });
  }

  // ── Visibility — fires on state transition ─────────────────────────────────

  /**
   * Fires when visibility state transitions.
   * Payload: { from, to } — matches EngineEventPayloadMap['THREAT_VISIBILITY_CHANGED'].
   */
  public emitVisibilityChanged(from: VisibilityState, to: VisibilityState): void {
    this.eventBus.emit('THREAT_VISIBILITY_CHANGED', { from, to });
  }

  // ── Threat lifecycle ───────────────────────────────────────────────────────

  /**
   * Fires when a queued threat transitions to ARRIVED.
   * Maps entry.entryId → threatId per EngineEventPayloadMap['THREAT_ARRIVED'].
   */
  public emitThreatArrived(entry: AnticipationEntry): void {
    this.eventBus.emit('THREAT_ARRIVED', {
      threatId:   entry.entryId,
      threatType: entry.threatType,
    });
  }

  /**
   * Fires when player successfully mitigates an arrived threat.
   * Payload: { threatId, cardUsed } — matches EngineEventPayloadMap['THREAT_MITIGATED'].
   */
  public emitThreatMitigated(threatId: string, cardUsed: string): void {
    this.eventBus.emit('THREAT_MITIGATED', { threatId, cardUsed });
  }

  /**
   * Fires when a threat expires without player mitigation.
   * Payload: { threatId, unmitigated } — matches EngineEventPayloadMap['THREAT_EXPIRED'].
   */
  public emitThreatExpired(entry: AnticipationEntry): void {
    this.eventBus.emit('THREAT_EXPIRED', {
      threatId:    entry.entryId,
      unmitigated: true,
    });
  }

  // ── Queue state ────────────────────────────────────────────────────────────

  /**
   * Fires when a threat enters the anticipation queue.
   * Payload: { threatId, threatType, arrivalTick } — matches EngineEventPayloadMap['THREAT_QUEUED'].
   */
  public emitThreatQueued(
    threatId:    string,
    threatType:  string,
    arrivalTick: number,
  ): void {
    this.eventBus.emit('THREAT_QUEUED', { threatId, threatType, arrivalTick });
  }
}