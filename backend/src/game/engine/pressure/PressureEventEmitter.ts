/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

import type { EventBus } from '../core/EventBus';
import type { EngineEventMap, PressureTier } from '../core/GamePrimitives';

export class PressureEventEmitter {
  public emit(bus: EventBus<EngineEventMap>, previousTier: PressureTier, nextTier: PressureTier, score: number): void {
    if (previousTier !== nextTier) {
      bus.emit('pressure.changed', { from: previousTier, to: nextTier, score });
    }
  }
}
