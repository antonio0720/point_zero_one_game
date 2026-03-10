/*
 * POINT ZERO ONE — BACKEND ENGINE MODE RUNTIME DIRECTOR
 * /backend/src/game/engine/modes/ModeRuntimeDirector.ts
 *
 * Doctrine:
 * - if engine-path modes exist, they need an execution surface
 * - configure/start/end/action/finalize should be routed consistently
 * - mode execution must be deterministic and side-effect free
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { ModeActionId, ModeConfigureOptions } from './ModeContracts';
import { DEFAULT_MODE_REGISTRY, ModeRegistry } from './ModeRegistry';

export class ModeRuntimeDirector {
  public constructor(
    private readonly registry: ModeRegistry = DEFAULT_MODE_REGISTRY,
  ) {}

  public configure(
    snapshot: RunStateSnapshot,
    options?: ModeConfigureOptions,
  ): RunStateSnapshot {
    return this.registry.mustGet(snapshot.mode).configure(snapshot, options);
  }

  public onTickStart(snapshot: RunStateSnapshot): RunStateSnapshot {
    const adapter = this.registry.mustGet(snapshot.mode);
    return adapter.onTickStart ? adapter.onTickStart(snapshot) : snapshot;
  }

  public onTickEnd(snapshot: RunStateSnapshot): RunStateSnapshot {
    const adapter = this.registry.mustGet(snapshot.mode);
    return adapter.onTickEnd ? adapter.onTickEnd(snapshot) : snapshot;
  }

  public resolveAction(
    snapshot: RunStateSnapshot,
    actionId: ModeActionId,
    payload?: Readonly<Record<string, unknown>>,
  ): RunStateSnapshot {
    const adapter = this.registry.mustGet(snapshot.mode);
    return adapter.resolveAction
      ? adapter.resolveAction(snapshot, actionId, payload)
      : snapshot;
  }

  public finalize(snapshot: RunStateSnapshot): RunStateSnapshot {
    const adapter = this.registry.mustGet(snapshot.mode);
    return adapter.finalize ? adapter.finalize(snapshot) : snapshot;
  }
}