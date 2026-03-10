// pzo-web/src/game/modes/empire/empireConfig.ts

/**
 * empireConfig.ts — Empire UI config and wave helpers
 *
 * FILE LOCATION: pzo-web/src/game/modes/empire/empireConfig.ts
 * Density6 LLC · Confidential
 */

import type { BleedSeverity } from './bleedMode';

export interface EmpireWave {
  wave: number;
  phase: string;
  activeBotIds: readonly string[];
}

export const BLEED_SEVERITY_COLORS: Record<BleedSeverity, string> = {
  NONE: '#2EE89A',
  WATCH: '#FF9B2F',
  CRITICAL: '#FF4D4D',
  TERMINAL: '#FF1744',
};

export const BLEED_SEVERITY_ICONS: Record<BleedSeverity, string> = {
  NONE: '●',
  WATCH: '⚠',
  CRITICAL: '☣',
  TERMINAL: '☠',
};

export const BLEED_SEVERITY_LABELS: Record<BleedSeverity, string> = {
  NONE: 'STABLE',
  WATCH: 'WATCH',
  CRITICAL: 'CRITICAL',
  TERMINAL: 'TERMINAL',
};

export function getEmpireWave(tick: number, totalTicks = 720): EmpireWave {
  const safeTick = Math.max(0, tick);
  const safeTotal = Math.max(1, totalTicks);
  const ratio = safeTick / safeTotal;

  if (ratio < 0.2) {
    return {
      wave: 1,
      phase: 'Quiet Entry',
      activeBotIds: [],
    };
  }
  if (ratio < 0.4) {
    return {
      wave: 2,
      phase: 'Pressure Build',
      activeBotIds: [],
    };
  }
  if (ratio < 0.6) {
    return {
      wave: 3,
      phase: 'Extraction Surge',
      activeBotIds: [],
    };
  }
  if (ratio < 0.8) {
    return {
      wave: 4,
      phase: 'Counter Fire',
      activeBotIds: [],
    };
  }
  return {
    wave: 5,
    phase: 'Sovereign Closeout',
    activeBotIds: [],
  };
}