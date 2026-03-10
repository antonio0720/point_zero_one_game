/*
 * POINT ZERO ONE — BACKEND PRESSURE EVENT EMITTER
 * /backend/src/game/engine/pressure/PressureEventEmitter.ts
 *
 * Doctrine:
 * - pressure events should only emit on meaningful state transitions
 * - event payloads stay backward-compatible with EngineEventMap
 */

import type { EventBus } from '../core/EventBus';
import type { EngineEventMap } from '../core/GamePrimitives';
import type { PressureState } from '../core/RunStateSnapshot';

export class PressureEventEmitter {
  public emit(
    bus: EventBus<EngineEventMap>,
    previous: PressureState,
    next: PressureState,
  ): void {
    if (previous.tier !== next.tier) {
      bus.emit('pressure.changed', {
        from: previous.tier,
        to: next.tier,
        score: next.score,
      });
    }
  }
}