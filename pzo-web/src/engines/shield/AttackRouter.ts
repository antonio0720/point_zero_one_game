//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/shield/AttackRouter.ts

/**
 * FILE: pzo-web/src/engines/shield/AttackRouter.ts
 * Stateless routing logic: AttackType → { primary, fallback } ShieldLayerIds.
 * For HATER_INJECTION: computes weakest layer dynamically from current states.
 *
 * ✦ Self-check rule #1: This file does NOT import ShieldLayerManager or any engine module.
 *   It is stateless and takes layer states as arguments.
 *
 * Density6 LLC · Point Zero One · Engine 4 of 7 · Confidential
 */
import { AttackType, ShieldLayerId, ShieldLayerState, SHIELD_LAYER_ORDER } from './types';

export interface RouteResult {
  primary: ShieldLayerId;
  fallback: ShieldLayerId | null;
}

// Primary routing table — all 8 AttackTypes must be present
const ROUTE_TABLE: Readonly<Record<AttackType, RouteResult>> = Object.freeze({
  [AttackType.FINANCIAL_SABOTAGE]:  { primary: ShieldLayerId.LIQUIDITY_BUFFER, fallback: ShieldLayerId.CREDIT_LINE },
  [AttackType.EXPENSE_INJECTION]:   { primary: ShieldLayerId.LIQUIDITY_BUFFER, fallback: ShieldLayerId.CREDIT_LINE },
  [AttackType.DEBT_ATTACK]:         { primary: ShieldLayerId.CREDIT_LINE,      fallback: ShieldLayerId.ASSET_FLOOR },
  [AttackType.ASSET_STRIP]:         { primary: ShieldLayerId.ASSET_FLOOR,      fallback: ShieldLayerId.NETWORK_CORE },
  [AttackType.REPUTATION_ATTACK]:   { primary: ShieldLayerId.NETWORK_CORE,     fallback: ShieldLayerId.LIQUIDITY_BUFFER },
  [AttackType.REGULATORY_ATTACK]:   { primary: ShieldLayerId.NETWORK_CORE,     fallback: ShieldLayerId.ASSET_FLOOR },
  [AttackType.OPPORTUNITY_KILL]:    { primary: ShieldLayerId.ASSET_FLOOR,      fallback: ShieldLayerId.CREDIT_LINE },
  [AttackType.HATER_INJECTION]:     { primary: ShieldLayerId.LIQUIDITY_BUFFER, fallback: ShieldLayerId.CREDIT_LINE }, // overridden below
});

export class AttackRouter {

  /**
   * Resolve the route for an attack.
   * For HATER_INJECTION: dynamically computes weakest + second weakest from current states.
   * For all other types: returns the static ROUTE_TABLE entry.
   */
  public resolveTarget(
    attackType: AttackType,
    currentLayers: ShieldLayerState[],
  ): RouteResult {
    if (attackType === AttackType.HATER_INJECTION) {
      return this.weakestTwo(currentLayers);
    }
    return ROUTE_TABLE[attackType];
  }

  /**
   * Sort layers by integrity percentage ascending (weakest first).
   * Tie-breaking: inner layer (higher order index) wins.
   * Returns { primary: weakest, fallback: second weakest }.
   *
   * Weakest layer = min(currentIntegrity / maxIntegrity) — NOT raw pts.
   * Computation happens at attack resolution time — never cached.
   */
  private weakestTwo(layers: ShieldLayerState[]): RouteResult {
    const sorted = [...layers].sort((a, b) => {
      if (a.integrityPct !== b.integrityPct) return a.integrityPct - b.integrityPct;
      // Tie: inner layer (higher order index) wins
      return SHIELD_LAYER_ORDER.indexOf(b.id) - SHIELD_LAYER_ORDER.indexOf(a.id);
    });
    return {
      primary: sorted[0].id,
      fallback: sorted[1]?.id ?? null,
    };
  }

  /**
   * Given a RouteResult and current layer states, return the effective target layer.
   *
   * Rules:
   * 1. If primary layer is not breached → return primary.
   * 2. If primary is breached and fallback is not → return fallback.
   * 3. If both are breached → find innermost non-zero layer.
   * 4. If ALL layers are zero → return NETWORK_CORE (cascade death spiral).
   *
   * ⚠ An attack that finds its primary at zero still fires — it just routes elsewhere.
   *    The breach consequence does NOT re-fire because the layer is already at zero.
   */
  public resolveEffectiveTarget(
    route: RouteResult,
    currentLayers: ShieldLayerState[],
  ): ShieldLayerId {
    const map = new Map(currentLayers.map(l => [l.id, l]));

    if (!map.get(route.primary)!.isBreached) return route.primary;
    if (route.fallback && !map.get(route.fallback)!.isBreached) return route.fallback;

    // Find innermost non-zero layer (highest index in SHIELD_LAYER_ORDER)
    for (let i = SHIELD_LAYER_ORDER.length - 1; i >= 0; i--) {
      const id = SHIELD_LAYER_ORDER[i];
      if (!map.get(id)!.isBreached) return id;
    }

    // All layers at zero — cascade death spiral
    return ShieldLayerId.NETWORK_CORE;
  }
}