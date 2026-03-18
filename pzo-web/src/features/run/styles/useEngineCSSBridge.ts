'use client';

import { useEffect, useMemo } from 'react';
import { useEngineStore } from '../store/engineStore';

type AnyDict = Record<string, unknown>;

function asDict(value: unknown): AnyDict {
  return value && typeof value === 'object' ? (value as AnyDict) : {};
}

function readNum(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return '';
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalize(value: number): number {
  const abs = Math.abs(value);
  return abs > 1 ? clamp01(abs / 100) : clamp01(abs);
}

function modeToDom(mode: string): string {
  switch (mode) {
    case 'solo':
    case 'go-alone':
      return 'solo';
    case 'asymmetric-pvp':
    case 'head-to-head':
      return 'asymmetric-pvp';
    case 'co-op':
    case 'team-up':
      return 'co-op';
    case 'ghost':
    case 'chase-a-legend':
      return 'ghost';
    default:
      return 'solo';
  }
}

export interface EngineCSSBridgeSnapshot {
  pressure01: number;
  tension01: number;
  shield01: number;
  battle01: number;
  cascade01: number;
  sovereignty01: number;
  time01: number;
  mode: string;
  lifecycleState: string;
}

export function useEngineCSSBridge(): EngineCSSBridgeSnapshot {
  const pressureSlice = useEngineStore((s: any) => s.pressure);
  const tensionSlice = useEngineStore((s: any) => s.tension);
  const shieldSlice = useEngineStore((s: any) => s.shield);
  const battleSlice = useEngineStore((s: any) => s.battle);
  const cascadeSlice = useEngineStore((s: any) => s.cascade);
  const sovereigntySlice = useEngineStore((s: any) => s.sovereignty);
  const timeSlice = useEngineStore((s: any) => s.time);
  const runSlice = useEngineStore((s: any) => s.run);

  const snapshot = useMemo<EngineCSSBridgeSnapshot>(() => {
    const pressure = asDict(pressureSlice);
    const tension = asDict(tensionSlice);
    const shield = asDict(shieldSlice);
    const battle = asDict(battleSlice);
    const cascade = asDict(cascadeSlice);
    const sovereignty = asDict(sovereigntySlice);
    const time = asDict(timeSlice);
    const run = asDict(runSlice);

    const timeRemainingPct = readNum(
      time.remainingPct,
      time.timeRemainingPct,
      time.seasonRemainingPct,
      readNum(time.ticksRemaining, 0) > 0 && readNum(time.seasonTickBudget, 0) > 0
        ? (readNum(time.ticksRemaining, 0) / Math.max(1, readNum(time.seasonTickBudget, 0))) * 100
        : 0,
    );

    return {
      pressure01: normalize(readNum(pressure.score, pressure.pressureScore, pressure.intensity)),
      tension01: normalize(readNum(tension.score, tension.tensionScore, tension.intensity)),
      shield01: normalize(
        readNum(shield.overallPct, shield.integrity, shield.overallIntegrityPct, shield.overallPct100),
      ),
      battle01: normalize(readNum(battle.intensity, battle.haterHeat, battle.heat, battle.battleHeatPct)),
      cascade01: normalize(readNum(cascade.chainStrength, cascade.intensity, cascade.activeChainCount)),
      sovereignty01: normalize(readNum(sovereignty.score, sovereignty.sovereigntyScore, sovereignty.integrityScore)),
      time01: normalize(timeRemainingPct),
      mode: modeToDom(
        readString(run.mode, run.runMode, run.activeMode, run.currentMode) ||
          (typeof window !== 'undefined'
            ? window.sessionStorage.getItem('pzo.activeMode') ||
              window.localStorage.getItem('pzo.activeMode') ||
              'solo'
            : 'solo'),
      ),
      lifecycleState: readString(run.lifecycleState, run.status) || 'IDLE',
    };
  }, [
    pressureSlice,
    tensionSlice,
    shieldSlice,
    battleSlice,
    cascadeSlice,
    sovereigntySlice,
    timeSlice,
    runSlice,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--engine-pressure', String(snapshot.pressure01));
    root.style.setProperty('--engine-tension', String(snapshot.tension01));
    root.style.setProperty('--engine-shield', String(snapshot.shield01));
    root.style.setProperty('--engine-battle', String(snapshot.battle01));
    root.style.setProperty('--engine-cascade', String(snapshot.cascade01));
    root.style.setProperty('--engine-sovereignty', String(snapshot.sovereignty01));
    root.style.setProperty('--engine-time', String(snapshot.time01));
    root.style.setProperty('--pressure-opacity', snapshot.pressure01.toFixed(4));
    root.style.setProperty('--tension-speed', `${Math.max(0.52, 1.8 - snapshot.tension01 * 1.25).toFixed(2)}s`);
    root.style.setProperty('--shield-glow-radius', `${Math.round(10 + snapshot.shield01 * 30)}px`);
    root.style.setProperty('--battle-ripple-strength', snapshot.battle01.toFixed(4));
    root.style.setProperty('--cascade-particle-opacity', snapshot.cascade01.toFixed(4));
    root.style.setProperty('--sovereignty-saturation', `${(1 + snapshot.sovereignty01 * 0.55).toFixed(3)}`);
    root.style.setProperty('--time-drain', snapshot.time01.toFixed(4));
    root.dataset.runMode = snapshot.mode;
    root.dataset.runLifecycle = snapshot.lifecycleState.toLowerCase();
  }, [snapshot]);

  return snapshot;
}

export default useEngineCSSBridge;
