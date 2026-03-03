//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/hooks/useShieldEngine.ts

/**
 * FILE: pzo-web/src/features/run/hooks/useShieldEngine.ts
 * React hook — reads Shield Engine state from Zustand store.
 * No direct engine calls. All data flows through the store via EventBus events.
 *
 * Density6 LLC · Point Zero One · Engine 4 of 7 · Confidential
 */
import { useEngineStore } from '../../../store/engineStore';
import { ShieldLayerId } from '../../../engines/shield/types';

export function useShieldEngine() {
  const snapshot  = useEngineStore(s => s.shield.snapshot);
  const layers    = snapshot?.layers ?? null;
  const overall   = useEngineStore(s => s.shield.overallIntegrityPct);
  const fortified = useEngineStore(s => s.shield.isFortified);
  const weakest   = useEngineStore(s => s.shield.weakestLayerId);
  const cascades  = useEngineStore(s => s.shield.cascadeCount);
  const inCascade = useEngineStore(s => s.shield.isInBreachCascade);
  const lastDmg   = useEngineStore(s => s.shield.lastDamageResult);
  const lastBreach = useEngineStore(s => s.shield.lastBreachedLayerId);

  return {
    // Snapshot
    snapshot,

    // Per-layer accessors
    layers,
    l1: layers?.[ShieldLayerId.LIQUIDITY_BUFFER] ?? null,
    l2: layers?.[ShieldLayerId.CREDIT_LINE]      ?? null,
    l3: layers?.[ShieldLayerId.ASSET_FLOOR]      ?? null,
    l4: layers?.[ShieldLayerId.NETWORK_CORE]     ?? null,

    // Aggregate values
    overallPct:    overall,
    overallPct100: Math.round(overall * 100),

    // Status flags
    isFortified:    fortified,
    weakestLayerId: weakest,
    cascadeCount:   cascades,
    isInBreachCascade: inCascade,

    // Warning helpers
    isAnyCritical: layers
      ? Object.values(layers).some(l => l.isCriticalWarning)
      : false,
    isAnyBreached: layers
      ? Object.values(layers).some(l => l.isBreached)
      : false,
    isAnyLow: layers
      ? Object.values(layers).some(l => l.isLowWarning)
      : false,

    // Event trace (last events for animation triggers)
    lastDamageResult:    lastDmg,
    lastBreachedLayerId: lastBreach,
  };
}