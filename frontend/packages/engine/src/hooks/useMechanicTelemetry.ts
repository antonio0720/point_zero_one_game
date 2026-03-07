// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/hooks/useMechanicTelemetry.ts
// Sprint 1: Mechanic Runtime Hook — extracted from App.tsx
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// Owns the mechanic runtime state (heat, activations, confidence, signal).
// Separate from runReducer because this is telemetry/observability concern,
// not game economy.

import { useState, useCallback } from 'react';
import { clamp } from '../game/core/math';
import { initRuntime, decayRuntime } from '../game/core/mechanicCatalog';
import type { MechanicDef, MechanicFamily, MechanicRuntimeState } from '../game/core/mechanicCatalog';

export interface UseMechanicTelemetryReturn {
  runtime:       Record<string, MechanicRuntimeState>;
  touchMechanic: (id: string, signal?: number) => void;
  touchFamily:   (family: MechanicFamily, baseSignal?: number) => void;
  decayAll:      () => void;
  resetRuntime:  () => void;
}

export function useMechanicTelemetry(catalog: MechanicDef[]): UseMechanicTelemetryReturn {
  const [runtime, setRuntime] = useState<Record<string, MechanicRuntimeState>>(() => initRuntime(catalog));

  const touchMechanic = useCallback((id: string, signal = 0.12) => {
    setRuntime((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return {
        ...prev,
        [id]: {
          ...current,
          activations: current.activations + 1,
          lastTick: Date.now(),  // approximate — replaced by tick in engine layer
          heat:       clamp(current.heat + 0.12 + signal * 0.25, 0, 5),
          confidence: clamp(current.confidence + 0.01 + signal * 0.05, 0.08, 0.99),
          signal:     clamp(current.signal + signal, -3, 3),
        },
      };
    });
  }, []);

  const touchFamily = useCallback((family: MechanicFamily, baseSignal = 0.10) => {
    const corePick = catalog.find((m) => m.kind === 'core' && m.family === family);
    const mlPick   = catalog.find((m) => m.kind === 'ml' && m.family === family);
    if (corePick) touchMechanic(corePick.id, baseSignal);
    if (mlPick)   touchMechanic(mlPick.id, baseSignal + 0.04);
  }, [catalog, touchMechanic]);

  const decayAll = useCallback(() => {
    setRuntime((prev) => decayRuntime(prev));
  }, []);

  const resetRuntime = useCallback(() => {
    setRuntime(initRuntime(catalog));
  }, [catalog]);

  return { runtime, touchMechanic, touchFamily, decayAll, resetRuntime };
}
