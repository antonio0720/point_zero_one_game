//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/shield/ShieldLayerManager.ts

/**
 * FILE: pzo-web/src/engines/shield/ShieldLayerManager.ts
 * Pure state management for shield layer integrity.
 * Applies damage, tracks warnings, detects fortified state,
 * applies passive regen, and executes cascade cracks.
 *
 * No events. No routing. No repair job scheduling.
 * Density6 LLC · Point Zero One · Engine 4 of 7 · Confidential
 */
import {
  ShieldLayerId,
  ShieldLayerState,
  ShieldLayerConfig,
  SHIELD_LAYER_CONFIGS,
  SHIELD_LAYER_ORDER,
  SHIELD_CONSTANTS,
} from './types';

export class ShieldLayerManager {
  private layers: Map<ShieldLayerId, ShieldLayerState>;

  // Tracks which layers breached THIS tick so regen is skipped for them.
  // Cleared at end of tickPassiveRegen().
  private justBreachedThisTick: Set<ShieldLayerId> = new Set();

  constructor() {
    this.layers = new Map();
    for (const id of SHIELD_LAYER_ORDER) {
      this.layers.set(id, this.buildInitialState(SHIELD_LAYER_CONFIGS[id]));
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  private buildInitialState(cfg: ShieldLayerConfig): ShieldLayerState {
    return {
      id: cfg.id,
      name: cfg.name,
      maxIntegrity: cfg.maxIntegrity,
      colorHex: cfg.colorHex,
      currentIntegrity: cfg.maxIntegrity,
      isBreached: false,
      integrityPct: 1.0,
      isCriticalWarning: false,
      isLowWarning: false,
      lastBreachTick: null,
      totalBreachCount: 0,
      pendingRepairPts: 0,
    };
  }

  // ── Damage ───────────────────────────────────────────────────────────────

  /**
   * Apply effectiveDamage to a layer. Clamps at 0 (no negative integrity).
   * ⚠ OVERFLOW RULE: damage stops at 0. It does NOT bleed to adjacent layers.
   *
   * Returns: { newIntegrity, breachOccurred, wasAlreadyBreached }
   * breachOccurred = true ONLY on the TRANSITION from > 0 to 0.
   * A layer already at 0 → breachOccurred = false, wasAlreadyBreached = true.
   */
  public applyDamage(
    layerId: ShieldLayerId,
    effectiveDamage: number,
    currentTick: number,
  ): { newIntegrity: number; breachOccurred: boolean; wasAlreadyBreached: boolean } {
    const layer = this.layers.get(layerId)!;
    const wasAlreadyBreached = layer.isBreached;

    // ⚠ Math.max(0, ...) guard — integrity never goes negative
    layer.currentIntegrity = Math.max(0, layer.currentIntegrity - effectiveDamage);
    this.updateFlags(layer);

    const breachOccurred = layer.isBreached && !wasAlreadyBreached;
    if (breachOccurred) {
      layer.totalBreachCount++;
      layer.lastBreachTick = currentTick;
      this.justBreachedThisTick.add(layerId);
    }

    return { newIntegrity: layer.currentIntegrity, breachOccurred, wasAlreadyBreached };
  }

  // ── Repair ───────────────────────────────────────────────────────────────

  /**
   * Apply repair pts to a layer. Clamped at maxIntegrity — never overflows.
   * Returns actual pts applied (may be less if near cap).
   */
  public applyRepair(layerId: ShieldLayerId, pts: number): number {
    const layer = this.layers.get(layerId)!;
    const before = layer.currentIntegrity;
    layer.currentIntegrity = Math.min(layer.maxIntegrity, layer.currentIntegrity + pts);
    this.updateFlags(layer);
    return layer.currentIntegrity - before;
  }

  // ── Passive Regen ─────────────────────────────────────────────────────────

  /**
   * Apply one tick of passive regen to all layers.
   * ✦ Layers that breached THIS tick are skipped entirely (justBreachedThisTick).
   * ✦ L3/L4 breachedRegenRate = 0 → frozen when breached, no pts delivered.
   * ✦ Regen capped at each layer's maxIntegrity.
   *
   * Returns: Map<ShieldLayerId, ptsApplied>
   * IMPORTANT: justBreachedThisTick is cleared at end of this call.
   *            Call clearBreachFlags() is NOT needed separately.
   */
  public tickPassiveRegen(): Map<ShieldLayerId, number> {
    const applied = new Map<ShieldLayerId, number>();

    for (const id of SHIELD_LAYER_ORDER) {
      // Skip breach tick
      if (this.justBreachedThisTick.has(id)) {
        applied.set(id, 0);
        continue;
      }

      const layer = this.layers.get(id)!;
      const cfg = SHIELD_LAYER_CONFIGS[id];
      const rate = layer.isBreached ? cfg.breachedRegenRate : cfg.passiveRegenRate;

      if (rate > 0 && layer.currentIntegrity < layer.maxIntegrity) {
        const before = layer.currentIntegrity;
        layer.currentIntegrity = Math.min(layer.maxIntegrity, layer.currentIntegrity + rate);
        this.updateFlags(layer);
        applied.set(id, layer.currentIntegrity - before);
      } else {
        applied.set(id, 0);
      }
    }

    // Reset breach-tick flags after regen pass
    this.justBreachedThisTick.clear();
    return applied;
  }

  // ── Cascade Crack ─────────────────────────────────────────────────────────

  /**
   * L4 breach consequence: crack all non-L4 layers to CASCADE_CRACK_PCT of their max.
   * ✦ Only REDUCES integrity — never increases it.
   * ✦ If a layer is already BELOW crackTarget, it stays where it is.
   * ✦ L4 (NETWORK_CORE) is skipped entirely — it just breached, leave at 0.
   */
  public applyCascadeCrack(currentTick: number): void {
    for (const id of SHIELD_LAYER_ORDER) {
      // ✦ Self-check rule #4: skip NETWORK_CORE
      if (id === ShieldLayerId.NETWORK_CORE) continue;

      const layer = this.layers.get(id)!;
      const crackTarget = Math.floor(layer.maxIntegrity * SHIELD_CONSTANTS.CASCADE_CRACK_PCT);

      if (layer.currentIntegrity > crackTarget) {
        layer.currentIntegrity = crackTarget;
        this.updateFlags(layer);
      }
      // If already at or below crackTarget — no change
    }
  }

  // ── Read API ──────────────────────────────────────────────────────────────

  public getLayer(id: ShieldLayerId): ShieldLayerState {
    return this.layers.get(id)!;
  }

  public getAllLayers(): ShieldLayerState[] {
    return SHIELD_LAYER_ORDER.map(id => this.layers.get(id)!);
  }

  /**
   * Weakest layer = min(currentIntegrity / maxIntegrity) across all 4 layers.
   * Tie-breaking: inner layer (higher index in SHIELD_LAYER_ORDER) wins.
   */
  public getWeakestLayerId(): ShieldLayerId {
    let weakId = SHIELD_LAYER_ORDER[0];
    let lowestPct = 1.0;

    for (const id of SHIELD_LAYER_ORDER) {
      const l = this.layers.get(id)!;
      if (l.integrityPct < lowestPct) {
        lowestPct = l.integrityPct;
        weakId = id;
      } else if (l.integrityPct === lowestPct) {
        // Tie: prefer inner layer (higher index = more consequential)
        if (SHIELD_LAYER_ORDER.indexOf(id) > SHIELD_LAYER_ORDER.indexOf(weakId)) {
          weakId = id;
        }
      }
    }

    return weakId;
  }

  /**
   * Fortified = ALL four layers simultaneously >= FORTIFIED_THRESHOLD (80%).
   */
  public isFortified(): boolean {
    return SHIELD_LAYER_ORDER.every(
      id => this.layers.get(id)!.integrityPct >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD,
    );
  }

  /**
   * Unweighted average of all 4 layers' integrityPcts.
   * A layer at 100/100 and a layer at 40/40 both contribute 1.0 equally.
   */
  public getOverallIntegrityPct(): number {
    const sum = SHIELD_LAYER_ORDER.reduce(
      (acc, id) => acc + this.layers.get(id)!.integrityPct,
      0,
    );
    return sum / SHIELD_LAYER_ORDER.length;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private updateFlags(layer: ShieldLayerState): void {
    layer.integrityPct = layer.currentIntegrity / layer.maxIntegrity;
    layer.isBreached = layer.currentIntegrity <= 0;
    layer.isLowWarning = layer.integrityPct < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD;
    layer.isCriticalWarning = layer.integrityPct < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  public reset(): void {
    this.layers.clear();
    this.justBreachedThisTick.clear();
    for (const id of SHIELD_LAYER_ORDER) {
      this.layers.set(id, this.buildInitialState(SHIELD_LAYER_CONFIGS[id]));
    }
  }
}