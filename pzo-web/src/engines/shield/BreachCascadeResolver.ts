//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/shield/BreachCascadeResolver.ts

/**
 * FILE: pzo-web/src/engines/shield/BreachCascadeResolver.ts
 * Handles L4 (NETWORK_CORE) breach consequences:
 *   1. Cracks all non-L4 layers to 20% of their max (via ShieldLayerManager).
 *   2. Emits CASCADE_TRIGGERED on the EventBus.
 *
 * ✦ Self-check rule #2: NEVER imports or calls CascadeEngine directly.
 *   CascadeEngine listens for CASCADE_TRIGGERED on EventBus independently.
 *
 * Density6 LLC · Point Zero One · Engine 4 of 7 · Confidential
 */
import { ShieldLayerId, CascadeTriggeredEvent, SHIELD_CONSTANTS } from './types';
import { ShieldLayerManager } from './ShieldLayerManager';
import type { EventBus } from '../core/EventBus';

export class BreachCascadeResolver {
  private cascadeCount = 0;

  constructor(
    private readonly eventBus: EventBus,
    private readonly layerManager: ShieldLayerManager,
  ) {}

  /**
   * Execute L4 breach consequence chain:
   * 1. Increment cascade counter.
   * 2. Apply cascade crack to all non-L4 layers (L1→20, L2→16, L3→12 pts).
   * 3. Emit CASCADE_TRIGGERED with haterHeatSetTo: 100.
   *
   * Called ONLY when ShieldEngine detects a fresh L4 breach (>0 → 0 transition).
   * Does NOT re-fire on repeated hits to an already-breached L4.
   */
  public resolve(currentTick: number): void {
    this.cascadeCount++;

    // Crack all outer layers to 20% floor
    this.layerManager.applyCascadeCrack(currentTick);

    const evt: CascadeTriggeredEvent = {
      eventType: 'CASCADE_TRIGGERED',
      sourceLayerId: ShieldLayerId.NETWORK_CORE,
      haterHeatSetTo: 100,
      allLayersCrackedTo: SHIELD_CONSTANTS.CASCADE_CRACK_PCT,
      tickNumber: currentTick,
      timestamp: Date.now(),
    };

    this.eventBus.emit('CASCADE_TRIGGERED', evt);
  }

  public getCascadeCount(): number {
    return this.cascadeCount;
  }

  public reset(): void {
    this.cascadeCount = 0;
  }
}