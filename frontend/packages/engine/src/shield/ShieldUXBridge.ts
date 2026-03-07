/**
 * FILE: pzo-web/src/engines/shield/ShieldUXBridge.ts
 *
 * Owns ALL EventBus.emit() calls from the Shield Engine.
 * No calculations, no state mutations, no routing decisions.
 *
 * CANONICAL BUS: zero/EventBus. Imports EventBus from '../zero/EventBus' only.
 * NEVER imports from core/EventBus or uses PZOEventChannel enum.
 *
 * Event name mapping (old name → registered EngineEventName):
 *   SHIELD_HIT           → SHIELD_LAYER_DAMAGED
 *   SHIELD_REPAIR        → SHIELD_REPAIRED
 *   SHIELD_PASSIVE_REGEN → SHIELD_PASSIVE_REGEN    (unchanged)
 *   SHIELD_LAYER_BREACHED→ SHIELD_LAYER_BREACHED   (unchanged)
 *   SHIELD_FORTIFIED     → SHIELD_FORTIFIED        (extended event)
 *   SHIELD_SNAPSHOT_UPDATED → SHIELD_SNAPSHOT_UPDATED (extended event)
 *
 * Payload fields match EngineEventPayloadMap exactly.
 * eventType, tickIndex, timestamp are in the EngineEvent ENVELOPE — not the payload.
 *
 * ✦ emitFortifiedIfNew() fires SHIELD_FORTIFIED ONCE on entry to fortified state.
 *   It does NOT re-fire while state persists. Resets on emitFortifiedIfNew(false).
 *
 * Density6 LLC · Point Zero One · Engine 4 of 7 · Confidential
 */
import type { DamageResult, ShieldLayerId, ShieldSnapshot } from './types';
import { SHIELD_LAYER_CONFIGS } from './types';
import type { EventBus } from '../zero/EventBus';

export class ShieldUXBridge {
  // ✦ SHIELD_FORTIFIED single-fire guard — entry only, not sustained state
  private wasFortifiedLastTick = false;

  constructor(private readonly eventBus: EventBus) {}

  // ── Hit — SHIELD_LAYER_DAMAGED ─────────────────────────────────────────────

  /**
   * Fires when an attack connects and reduces layer integrity.
   * Registered event: SHIELD_LAYER_DAMAGED.
   * Payload: { layer, damage, integrity, attackId }.
   */
  public emitShieldHit(result: DamageResult): void {
    this.eventBus.emit('SHIELD_LAYER_DAMAGED', {
      layer:     result.targetLayerId,
      damage:    result.effectiveDamage,
      integrity: result.postHitIntegrity,
      attackId:  result.attackId,
    });
  }

  // ── Breach — SHIELD_LAYER_BREACHED ────────────────────────────────────────

  /**
   * Fires when a layer hits zero integrity.
   * Registered event: SHIELD_LAYER_BREACHED.
   * Payload: { layer, cascadeEventId? }.
   */
  public emitLayerBreached(
    layerId:          ShieldLayerId,
    cascadeEventId?:  string,
  ): void {
    this.eventBus.emit('SHIELD_LAYER_BREACHED', {
      layer: layerId,
      ...(cascadeEventId ? { cascadeEventId } : {}),
    });
  }

  // ── Repair — SHIELD_REPAIRED ───────────────────────────────────────────────

  /**
   * Fires when a card action restores integrity to a layer.
   * Registered event: SHIELD_REPAIRED.
   * Payload: { layer, amount, newIntegrity }.
   */
  public emitRepair(
    layerId:      ShieldLayerId,
    amount:       number,
    newIntegrity: number,
  ): void {
    this.eventBus.emit('SHIELD_REPAIRED', {
      layer:        layerId,
      amount,
      newIntegrity,
    });
  }

  // ── Passive regen — SHIELD_PASSIVE_REGEN ─────────────────────────────────

  /**
   * Fires when passive regen ticks for a layer.
   * Registered event: SHIELD_PASSIVE_REGEN.
   * Payload: { layer, amount, newIntegrity }.
   */
  public emitPassiveRegen(
    layerId:      ShieldLayerId,
    amount:       number,
    newIntegrity: number,
  ): void {
    this.eventBus.emit('SHIELD_PASSIVE_REGEN', {
      layer:        layerId,
      amount,
      newIntegrity,
    });
  }

  // ── Fortified — SHIELD_FORTIFIED ──────────────────────────────────────────

  /**
   * ✦ Fires ONCE when entering fortified state (ALL layers >= 80%).
   * ✦ wasFortifiedLastTick guard: re-fires only after exiting and re-entering.
   * ✦ Registered event: SHIELD_FORTIFIED. Payload is empty object (presence = signal).
   */
  public emitFortifiedIfNew(isFortified: boolean): void {
    if (isFortified && !this.wasFortifiedLastTick) {
      this.eventBus.emit('SHIELD_FORTIFIED', {} as object);
    }
    this.wasFortifiedLastTick = isFortified;
  }

  // ── Snapshot — SHIELD_SNAPSHOT_UPDATED ───────────────────────────────────

  /**
   * Primary per-tick emit. Fires every tick after all shield processing.
   * Registered event: SHIELD_SNAPSHOT_UPDATED.
   * Payload: { snapshot } — opaque to zero/types.ts, typed in shield/types.ts.
   */
  public emitSnapshotUpdated(snapshot: ShieldSnapshot): void {
    this.eventBus.emit('SHIELD_SNAPSHOT_UPDATED', { snapshot });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  public reset(): void {
    this.wasFortifiedLastTick = false;
  }
}