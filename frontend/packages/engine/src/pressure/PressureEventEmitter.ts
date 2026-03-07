/**
 * FILE: pzo-web/src/engines/pressure/PressureEventEmitter.ts
 *
 * Wraps all outbound EventBus.emit() calls from the Pressure Engine.
 * Called by PressureEngine only. Does not calculate anything.
 *
 * CANONICAL BUS: zero/EventBus — all payloads match EngineEventPayloadMap.
 * eventType, tickIndex, timestamp live in the EngineEvent envelope stamped
 * by EventBus.emit(). They are NEVER duplicated inside the payload object.
 *
 * IEventBus interface is retained for pressure/types compatibility — zero/EventBus
 * satisfies it structurally (emit(event, payload) signature is compatible).
 *
 * Density6 LLC · Point Zero One · Engine 2 of 7 · Confidential
 */
import type { IEventBus, PressureTier, PressureSnapshot } from './types';

export class PressureEventEmitter {
  private readonly eventBus: IEventBus;
  private criticalEntered: boolean = false; // tracks first CRITICAL entry per run

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
  }

  // ── Score — fires every tick ───────────────────────────────────────────────

  /**
   * Emit PRESSURE_SCORE_UPDATED every tick.
   * Store listener updates engineStore.pressure.score.
   * Payload matches EngineEventPayloadMap['PRESSURE_SCORE_UPDATED'].
   */
  public emitScoreUpdated(snapshot: PressureSnapshot): void {
    this.eventBus.emit('PRESSURE_SCORE_UPDATED', {
      score:     snapshot.score,
      tier:      snapshot.tier,
      tickIndex: snapshot.tickNumber,
    });
  }

  // ── Tier change — fires only on transition ─────────────────────────────────

  /**
   * Emit PRESSURE_TIER_CHANGED only when tier transitions.
   * TimeEngine recalculates tick rate. BattleEngine recalculates injection
   * probability. Payload matches EngineEventPayloadMap['PRESSURE_TIER_CHANGED'].
   */
  public emitTierChanged(
    from:     PressureTier,
    to:       PressureTier,
    snapshot: PressureSnapshot,
  ): void {
    this.eventBus.emit('PRESSURE_TIER_CHANGED', {
      from,
      to,
      score: snapshot.score,
    });
  }

  // ── Critical — fires ONCE per run on first CRITICAL entry ─────────────────

  /**
   * Emit PRESSURE_CRITICAL exactly once per run, on first CRITICAL entry.
   * Does not re-fire if player dips out of CRITICAL and returns.
   * Resets to fire again on reset() (new run).
   * Payload matches EngineEventPayloadMap['PRESSURE_CRITICAL'].
   */
  public emitCriticalEntered(snapshot: PressureSnapshot): void {
    if (this.criticalEntered) return;
    this.criticalEntered = true;
    this.eventBus.emit('PRESSURE_CRITICAL', {
      score:          snapshot.score,
      triggerSignals: Object.keys(snapshot.signalBreakdown ?? {}),
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Reset at run start — allows PRESSURE_CRITICAL to fire again next run. */
  public reset(): void {
    this.criticalEntered = false;
  }
}