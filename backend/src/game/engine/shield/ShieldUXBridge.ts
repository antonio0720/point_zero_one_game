/*
 * POINT ZERO ONE — BACKEND SHIELD UX BRIDGE
 * /backend/src/game/engine/shield/ShieldUXBridge.ts
 *
 * Doctrine:
 * - shield-owned emits live here
 * - shield never directly calls downstream engines
 * - only typed bus traffic leaves this bridge
 */

import type { EventBus } from '../core/EventBus';
import type {
  EngineEventMap,
  ShieldLayerId,
} from '../core/GamePrimitives';

export class ShieldUXBridge {
  public emitLayerBreached(
    bus: EventBus<EngineEventMap>,
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
}