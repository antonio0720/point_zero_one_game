// backend/src/game/engine/zero/__tests__/DependencyBinder.spec.ts

import { describe, expect, it, vi } from 'vitest';

import { DependencyBinder } from '../DependencyBinder';

type PressureReader = {
  getCurrentScore: () => number;
  getCurrentTier: () => 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
  getStagnationCount: () => number;
};

type ShieldReader = {
  getOverallIntegrityPct: () => number;
  getLayerIntegrity: (layerId: 'L1' | 'L2' | 'L3' | 'L4') => number;
  getLayerIntegrityPct: (layerId: 'L1' | 'L2' | 'L3' | 'L4') => number;
  isLayerBreached: (layerId: 'L1' | 'L2' | 'L3' | 'L4') => boolean;
  getWeakestLayer: () => 'L1' | 'L2' | 'L3' | 'L4';
};

type TensionReader = {
  getCurrentTensionScore: () => number;
  getQueueDepth: () => number;
  getVisibilityState: () => 'SHADOWED' | 'SIGNALED' | 'TELEGRAPHED' | 'EXPOSED';
};

type CascadeReader = {
  getActiveChainCount: () => number;
  hasActiveChainsAboveSeverity: (severity: string) => boolean;
};

type TimeWithReaderSetter = {
  setPressureReader: (reader: PressureReader) => void;
};

type PressureWithReaderSetters = PressureReader & {
  setShieldReader: (reader: ShieldReader) => void;
  setCascadeReader: (reader: CascadeReader) => void;
};

type ShieldWithReaderSetter = ShieldReader & {
  setTensionReader: (reader: TensionReader) => void;
};

type BattleWithReaderSetters = {
  setShieldReader: (reader: ShieldReader) => void;
  setTensionReader: (reader: TensionReader) => void;
};

function buildGraph() {
  const time: TimeWithReaderSetter = {
    setPressureReader: vi.fn(),
  };

  const pressure: PressureWithReaderSetters = {
    setShieldReader: vi.fn(),
    setCascadeReader: vi.fn(),
    getCurrentScore: () => 0.42,
    getCurrentTier: () => 'T2',
    getStagnationCount: () => 3,
  };

  const shield: ShieldWithReaderSetter = {
    setTensionReader: vi.fn(),
    getOverallIntegrityPct: () => 88,
    getLayerIntegrity: (layerId) =>
      ({ L1: 100, L2: 75, L3: 55, L4: 40 } as const)[layerId],
    getLayerIntegrityPct: (layerId) =>
      ({ L1: 1, L2: 0.9375, L3: 0.9167, L4: 1 } as const)[layerId],
    isLayerBreached: () => false,
    getWeakestLayer: () => 'L3',
  };

  const tension: TensionReader = {
    getCurrentTensionScore: () => 0.31,
    getQueueDepth: () => 2,
    getVisibilityState: () => 'SIGNALED',
  };

  const cascade: CascadeReader = {
    getActiveChainCount: () => 1,
    hasActiveChainsAboveSeverity: (severity: string) => severity === 'HIGH',
  };

  const battle: BattleWithReaderSetters = {
    setShieldReader: vi.fn(),
    setTensionReader: vi.fn(),
  };

  return {
    time,
    pressure,
    shield,
    tension,
    cascade,
    battle,
  };
}

describe('DependencyBinder', () => {
  it('wires only the sanctioned reader graph and returns an immutable binding manifest', () => {
    const graph = buildGraph();
    const binder = new (DependencyBinder as any)();

    const manifest = binder.bind(graph);

    expect(graph.time.setPressureReader).toHaveBeenCalledTimes(1);
    expect(graph.time.setPressureReader).toHaveBeenCalledWith(graph.pressure);

    expect(graph.pressure.setShieldReader).toHaveBeenCalledTimes(1);
    expect(graph.pressure.setShieldReader).toHaveBeenCalledWith(graph.shield);

    expect(graph.pressure.setCascadeReader).toHaveBeenCalledTimes(1);
    expect(graph.pressure.setCascadeReader).toHaveBeenCalledWith(graph.cascade);

    expect(graph.shield.setTensionReader).toHaveBeenCalledTimes(1);
    expect(graph.shield.setTensionReader).toHaveBeenCalledWith(graph.tension);

    expect(graph.battle.setShieldReader).toHaveBeenCalledTimes(1);
    expect(graph.battle.setShieldReader).toHaveBeenCalledWith(graph.shield);

    expect(graph.battle.setTensionReader).toHaveBeenCalledTimes(1);
    expect(graph.battle.setTensionReader).toHaveBeenCalledWith(graph.tension);

    expect(manifest).toMatchObject({
      edges: [
        { from: 'pressure', to: 'time', contract: 'PressureReader' },
        { from: 'shield', to: 'pressure', contract: 'ShieldReader' },
        { from: 'cascade', to: 'pressure', contract: 'CascadeReader' },
        { from: 'tension', to: 'shield', contract: 'TensionReader' },
        { from: 'shield', to: 'battle', contract: 'ShieldReader' },
        { from: 'tension', to: 'battle', contract: 'TensionReader' },
      ],
    });

    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.edges)).toBe(true);
  });

  it('does not invent forbidden cross-engine bindings outside the declared reader lanes', () => {
    const graph = buildGraph();

    const pressureForbidden = vi.fn();
    const battleForbidden = vi.fn();
    const shieldForbidden = vi.fn();

    (graph.pressure as Record<string, unknown>).setTensionReader = pressureForbidden;
    (graph.battle as Record<string, unknown>).setCascadeReader = battleForbidden;
    (graph.shield as Record<string, unknown>).setPressureReader = shieldForbidden;

    const binder = new (DependencyBinder as any)();
    binder.bind(graph);

    expect(pressureForbidden).not.toHaveBeenCalled();
    expect(battleForbidden).not.toHaveBeenCalled();
    expect(shieldForbidden).not.toHaveBeenCalled();
  });

  it('fails loudly when a required reader setter is missing so orchestration drift cannot go silent', () => {
    const graph = buildGraph();
    delete (graph.time as Record<string, unknown>).setPressureReader;

    const binder = new (DependencyBinder as any)();

    expect(() => binder.bind(graph)).toThrow(
      /time|pressure|setPressureReader|DependencyBinder/i,
    );
  });

  it('supports rebinding a fresh engine graph without mutating the prior manifest', () => {
    const firstGraph = buildGraph();
    const secondGraph = buildGraph();

    const binder = new (DependencyBinder as any)();

    const firstManifest = binder.bind(firstGraph);
    const secondManifest = binder.bind(secondGraph);

    expect(firstManifest).not.toBe(secondManifest);
    expect(firstManifest.edges).toEqual(secondManifest.edges);

    expect(firstGraph.time.setPressureReader).toHaveBeenCalledTimes(1);
    expect(secondGraph.time.setPressureReader).toHaveBeenCalledTimes(1);

    expect(Object.isFrozen(firstManifest)).toBe(true);
    expect(Object.isFrozen(secondManifest)).toBe(true);
  });
});