// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/gapIndicatorEngine.ts
// Sprint 6 — Gap Indicator System
//
// The gap indicator shows how far behind/ahead the player is vs the legend.
// Gap affects: card draw weights, Nerve card eligibility, CORD scoring.
// Three gap zones: CLOSING | HOLDING | FALLING_BEHIND
// ═══════════════════════════════════════════════════════════════════════════

import { PHANTOM_CONFIG } from './phantomConfig';

export type GapZone = 'AHEAD' | 'CLOSING' | 'HOLDING' | 'FALLING_BEHIND' | 'CRITICAL';

export interface GapIndicatorState {
  zone: GapZone;
  netWorthGapPct: number;
  cordGapPct: number;
  /** Consecutive ticks in current zone */
  zoneStreakTicks: number;
  /** Peak gap reached this run */
  peakGapPct: number;
  /** CORD adjustment applied from gap this run */
  totalCordAdjustment: number;
  /** True when Nerve cards should activate */
  nerveEligible: boolean;
  /** Draw weight modifier for gap-closing cards */
  gapCardWeightBonus: number;
}

export const INITIAL_GAP_STATE: GapIndicatorState = {
  zone: 'HOLDING',
  netWorthGapPct: 0,
  cordGapPct: 0,
  zoneStreakTicks: 0,
  peakGapPct: 0,
  totalCordAdjustment: 0,
  nerveEligible: false,
  gapCardWeightBonus: 0,
};

// ─── Update ───────────────────────────────────────────────────────────────────

export function updateGapIndicator(
  state: GapIndicatorState,
  netWorthGapPct: number,
  cordGapPct: number,
  previousNetWorthGapPct: number,
): GapIndicatorState {
  const zone = classifyZone(netWorthGapPct, previousNetWorthGapPct);
  const zoneStreakTicks = zone === state.zone ? state.zoneStreakTicks + 1 : 1;
  const peakGapPct = Math.max(state.peakGapPct, netWorthGapPct);
  const nerveEligible = netWorthGapPct > PHANTOM_CONFIG.nerveCardActivationGap;
  const gapCardWeightBonus = computeGapCardWeight(netWorthGapPct, zone);

  // CORD adjustment: falling behind = mild negative; closing = positive
  const cordAdjustment = zone === 'CLOSING' ? 0.001
    : zone === 'FALLING_BEHIND' ? -0.001
    : zone === 'CRITICAL' ? -0.003
    : 0;
  const totalCordAdjustment = parseFloat((state.totalCordAdjustment + cordAdjustment).toFixed(4));

  return {
    zone,
    netWorthGapPct: parseFloat(netWorthGapPct.toFixed(4)),
    cordGapPct: parseFloat(cordGapPct.toFixed(4)),
    zoneStreakTicks,
    peakGapPct: parseFloat(peakGapPct.toFixed(4)),
    totalCordAdjustment,
    nerveEligible,
    gapCardWeightBonus: parseFloat(gapCardWeightBonus.toFixed(3)),
  };
}

// ─── Derived ──────────────────────────────────────────────────────────────────

export function gapZoneLabel(zone: GapZone): string {
  const labels: Record<GapZone, string> = {
    AHEAD: '▲ AHEAD',
    CLOSING: '▲ CLOSING',
    HOLDING: '— HOLDING',
    FALLING_BEHIND: '▼ FALLING',
    CRITICAL: '⚠ CRITICAL',
  };
  return labels[zone];
}

export function gapZoneColor(zone: GapZone): string {
  const colors: Record<GapZone, string> = {
    AHEAD: '#22c55e',
    CLOSING: '#86efac',
    HOLDING: '#a1a1aa',
    FALLING_BEHIND: '#f59e0b',
    CRITICAL: '#ef4444',
  };
  return colors[zone];
}

// ─── Internal ────────────────────────────────────────────────────────────────

function classifyZone(gapPct: number, prevGapPct: number): GapZone {
  if (gapPct < 0) return 'AHEAD';
  if (gapPct > 0.50) return 'CRITICAL';
  if (gapPct > 0.20) return 'FALLING_BEHIND';
  const closing = gapPct < prevGapPct;
  return closing ? 'CLOSING' : 'HOLDING';
}

function computeGapCardWeight(gapPct: number, zone: GapZone): number {
  // Gap-closing cards get higher draw weight when behind
  if (gapPct <= 0) return 0;
  if (zone === 'CRITICAL') return 0.35;
  if (zone === 'FALLING_BEHIND') return 0.20;
  if (zone === 'CLOSING') return 0.10;
  return 0;
}
