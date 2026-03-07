/**
 * empireConfig.ts — Empire Mode Configuration
 * Point Zero One · Density6 LLC · Confidential
 *
 * Phase wave definitions, bleed severity visual configs, and
 * the getEmpireWave() helper that maps tick → current wave.
 */

import type { BleedSeverity } from './bleedMode';

// ─── Empire Wave Phases ───────────────────────────────────────────────────────

export interface EmpireWaveConfig {
  id:          string;
  label:       string;
  startTick:   number;
  endTick:     number;
  accent:      string;
  description: string;
}

export const EMPIRE_WAVES: EmpireWaveConfig[] = [
  { id: 'FOUNDATION',   label: 'Foundation',   startTick: 0,   endTick: 119,  accent: '#22DD88', description: 'Build your first income streams.' },
  { id: 'GROWTH',       label: 'Growth',       startTick: 120, endTick: 299,  accent: '#4A9EFF', description: 'Scale income past expenses.' },
  { id: 'PRESSURE',     label: 'Pressure',     startTick: 300, endTick: 499,  accent: '#FF9B2F', description: 'Adversaries escalate. Defend and grow.' },
  { id: 'SOVEREIGNTY',  label: 'Sovereignty',  startTick: 500, endTick: 719,  accent: '#C9A84C', description: 'Achieve financial independence.' },
];

export const EMPIRE_PHASE_ACCENTS: Record<string, string> = Object.fromEntries(
  EMPIRE_WAVES.map(w => [w.id, w.accent])
);

export function getEmpireWave(tick: number): EmpireWaveConfig {
  for (let i = EMPIRE_WAVES.length - 1; i >= 0; i--) {
    if (tick >= EMPIRE_WAVES[i].startTick) return EMPIRE_WAVES[i];
  }
  return EMPIRE_WAVES[0];
}

// ─── Bleed Severity Visual Config ─────────────────────────────────────────────

export const BLEED_SEVERITY_COLORS: Record<BleedSeverity, string> = {
  NONE:     '#22DD88',
  LIGHT:    '#FFD700',
  MODERATE: '#FF9B2F',
  HEAVY:    '#FF4D4D',
  CRITICAL: '#FF1744',
};

export const BLEED_SEVERITY_ICONS: Record<BleedSeverity, string> = {
  NONE:     '✅',
  LIGHT:    '⚠️',
  MODERATE: '🔶',
  HEAVY:    '🔴',
  CRITICAL: '💀',
};

export const BLEED_SEVERITY_LABELS: Record<BleedSeverity, string> = {
  NONE:     'Stable',
  LIGHT:    'Draining',
  MODERATE: 'Bleeding',
  HEAVY:    'Hemorrhaging',
  CRITICAL: 'Critical Bleed',
};
