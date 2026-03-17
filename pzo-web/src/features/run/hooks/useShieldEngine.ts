// pzo-web/src/features/run/hooks/useShieldEngine.ts

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
  useEngineStore,
  type EngineStoreState,
} from '../../../store/engineStore';
import {
  ShieldLayerId,
  type DamageResult,
  type ShieldLayerState,
  type ShieldSnapshot,
} from '../../../engines/shield/types';

type IntegrityBand = 'STABLE' | 'LOW' | 'CRITICAL' | 'COLLAPSED';

export interface UseShieldEngineResult {
  readonly snapshot: ShieldSnapshot | null;
  readonly layers: ShieldSnapshot['layers'] | null;

  readonly l1: ShieldLayerState | null;
  readonly l2: ShieldLayerState | null;
  readonly l3: ShieldLayerState | null;
  readonly l4: ShieldLayerState | null;

  readonly orderedLayers: readonly ShieldLayerState[];
  readonly weakestLayer: ShieldLayerState | null;
  readonly weakestLayerId: ShieldLayerId | null;

  readonly overallPct: number;
  readonly overallIntegrityPct: number;
  readonly overallPct100: number;
  readonly integrityBand: IntegrityBand;

  readonly isFortified: boolean;
  readonly cascadeCount: number;
  readonly isInBreachCascade: boolean;
  readonly isRunActive: boolean;

  readonly isAnyCritical: boolean;
  readonly isAnyBreached: boolean;
  readonly isAnyLow: boolean;

  readonly lowLayerCount: number;
  readonly criticalLayerCount: number;
  readonly breachedLayerCount: number;

  readonly breachedLayerIds: readonly ShieldLayerId[];
  readonly lowLayerIds: readonly ShieldLayerId[];
  readonly criticalLayerIds: readonly ShieldLayerId[];

  readonly totalPendingRepairPts: number;
  readonly totalBreachCount: number;

  readonly tickNumber: number;
  readonly timestamp: number | null;

  readonly lastDamageResult: DamageResult | null;
  readonly lastBreachedLayerId: ShieldLayerId | null;
  readonly lastHitLayerId: ShieldLayerId | null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function resolveIntegrityBand(
  overallPct: number,
  isAnyBreached: boolean,
  isAnyCritical: boolean,
  isAnyLow: boolean,
): IntegrityBand {
  if (isAnyBreached || overallPct <= 0.1) return 'COLLAPSED';
  if (isAnyCritical || overallPct <= 0.25) return 'CRITICAL';
  if (isAnyLow || overallPct <= 0.5) return 'LOW';
  return 'STABLE';
}

export function useShieldEngine(): UseShieldEngineResult {
  const shield = useEngineStore(
    useShallow((state: EngineStoreState) => ({
      snapshot: state.shield.snapshot,
      overallIntegrityPct: state.shield.overallIntegrityPct,
      weakestLayerId: state.shield.weakestLayerId,
      isFortified: state.shield.isFortified,
      cascadeCount: state.shield.cascadeCount,
      isInBreachCascade: state.shield.isInBreachCascade,
      isRunActive: state.shield.isRunActive,
      lastDamageResult: state.shield.lastDamageResult,
      lastBreachedLayerId: state.shield.lastBreachedLayerId,
    })),
  );

  return useMemo<UseShieldEngineResult>(() => {
    const snapshot = shield.snapshot ?? null;
    const layers = snapshot?.layers ?? null;

    const l1 = layers?.[ShieldLayerId.LIQUIDITY_BUFFER] ?? null;
    const l2 = layers?.[ShieldLayerId.CREDIT_LINE] ?? null;
    const l3 = layers?.[ShieldLayerId.ASSET_FLOOR] ?? null;
    const l4 = layers?.[ShieldLayerId.NETWORK_CORE] ?? null;

    const orderedLayers = [l1, l2, l3, l4].filter(
      (layer): layer is ShieldLayerState => layer !== null,
    );

    const overallPct = clamp01(
      snapshot?.overallIntegrityPct ?? shield.overallIntegrityPct ?? 0,
    );

    const weakestLayerId = snapshot?.weakestLayerId ?? shield.weakestLayerId ?? null;
    const weakestLayer =
      weakestLayerId && layers ? layers[weakestLayerId] ?? null : null;

    const breachedLayerIds = orderedLayers
      .filter((layer) => layer.isBreached)
      .map((layer) => layer.id);

    const lowLayerIds = orderedLayers
      .filter((layer) => layer.isLowWarning)
      .map((layer) => layer.id);

    const criticalLayerIds = orderedLayers
      .filter((layer) => layer.isCriticalWarning)
      .map((layer) => layer.id);

    const isAnyBreached = breachedLayerIds.length > 0;
    const isAnyLow = lowLayerIds.length > 0;
    const isAnyCritical = criticalLayerIds.length > 0;

    const totalPendingRepairPts = orderedLayers.reduce(
      (sum, layer) => sum + (Number.isFinite(layer.pendingRepairPts) ? layer.pendingRepairPts : 0),
      0,
    );

    const totalBreachCount = orderedLayers.reduce(
      (sum, layer) => sum + (Number.isFinite(layer.totalBreachCount) ? layer.totalBreachCount : 0),
      0,
    );

    return {
      snapshot,
      layers,

      l1,
      l2,
      l3,
      l4,

      orderedLayers,
      weakestLayer,
      weakestLayerId,

      overallPct,
      overallIntegrityPct: overallPct,
      overallPct100: Math.round(overallPct * 100),
      integrityBand: resolveIntegrityBand(
        overallPct,
        isAnyBreached,
        isAnyCritical,
        isAnyLow,
      ),

      isFortified: Boolean(snapshot?.isFortified ?? shield.isFortified),
      cascadeCount: Math.max(0, snapshot?.cascadeCount ?? shield.cascadeCount ?? 0),
      isInBreachCascade: Boolean(
        snapshot?.isInBreachCascade ?? shield.isInBreachCascade,
      ),
      isRunActive: Boolean(shield.isRunActive),

      isAnyCritical,
      isAnyBreached,
      isAnyLow,

      lowLayerCount: lowLayerIds.length,
      criticalLayerCount: criticalLayerIds.length,
      breachedLayerCount: breachedLayerIds.length,

      breachedLayerIds,
      lowLayerIds,
      criticalLayerIds,

      totalPendingRepairPts,
      totalBreachCount,

      tickNumber: snapshot?.tickNumber ?? 0,
      timestamp: snapshot?.timestamp ?? null,

      lastDamageResult: shield.lastDamageResult ?? null,
      lastBreachedLayerId: shield.lastBreachedLayerId ?? null,
      lastHitLayerId: shield.lastDamageResult?.targetLayerId ?? null,
    };
  }, [shield]);
}

export default useShieldEngine;