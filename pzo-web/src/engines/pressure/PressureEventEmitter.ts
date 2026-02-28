/**
 * FILE: pzo-web/src/engines/pressure/PressureEventEmitter.ts
 * Wraps all outbound EventBus.emit() calls from the Pressure Engine.
 * Called by PressureEngine only. Does not calculate anything.
 * Uses IEventBus interface — no direct dependency on core/EventBus implementation.
 */
import type {
  IEventBus,
  PressureTier,
  PressureSnapshot,
  PressureTierChangedEvent,
  PressureScoreUpdatedEvent,
  PressureCriticalEnteredEvent,
} from './types';

export class PressureEventEmitter {
  private readonly eventBus: IEventBus;
  private criticalEntered: boolean = false; // tracks first CRITICAL entry per run

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Emit PRESSURE_SCORE_UPDATED every tick.
   * Always fires. Store listener updates engineStore.pressure.score.
   */
  public emitScoreUpdated(snapshot: PressureSnapshot): void {
    const event: PressureScoreUpdatedEvent = {
      eventType:       'PRESSURE_SCORE_UPDATED',
      score:           snapshot.score,
      tier:            snapshot.tier,
      tickNumber:      snapshot.tickNumber,
      timestamp:       snapshot.timestamp,
      signalBreakdown: snapshot.signalBreakdown as Record<string, number>,
    };
    this.eventBus.emit('PRESSURE_SCORE_UPDATED', event);
  }

  /**
   * Emit PRESSURE_TIER_CHANGED only when tier changes.
   * TimeEngine listens to this to recalculate tick rate.
   * BattleEngine listens to recalculate injection probability.
   */
  public emitTierChanged(
    from:     PressureTier,
    to:       PressureTier,
    snapshot: PressureSnapshot,
  ): void {
    const event: PressureTierChangedEvent = {
      eventType:   'PRESSURE_TIER_CHANGED',
      from,
      to,
      score:       snapshot.score,
      tickNumber:  snapshot.tickNumber,
      timestamp:   snapshot.timestamp,
      isEscalating: snapshot.isEscalating,
    };
    this.eventBus.emit('PRESSURE_TIER_CHANGED', event);
  }

  /**
   * Emit PRESSURE_CRITICAL_ENTERED exactly once per run, on first CRITICAL entry.
   * Does not re-fire if player dips out of CRITICAL and returns.
   * Fires again after reset() (new run).
   */
  public emitCriticalEntered(snapshot: PressureSnapshot): void {
    if (this.criticalEntered) return;
    this.criticalEntered = true;
    const event: PressureCriticalEnteredEvent = {
      eventType:  'PRESSURE_CRITICAL_ENTERED',
      score:      snapshot.score,
      tickNumber: snapshot.tickNumber,
      timestamp:  snapshot.timestamp,
    };
    this.eventBus.emit('PRESSURE_CRITICAL_ENTERED', event);
  }

  /** Reset at run start — allows PRESSURE_CRITICAL_ENTERED to fire again. */
  public reset(): void {
    this.criticalEntered = false;
  }
}
