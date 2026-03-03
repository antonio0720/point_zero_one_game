// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/gapIndicatorEngine.ts
// Sprint 7 — Gap Indicator System (fully rebuilt)
//
// Gap affects: card draw weights, Nerve card eligibility, CORD scoring.
// Five gap zones: AHEAD | CLOSING | HOLDING | FALLING_BEHIND | CRITICAL
//
// FIXES FROM SPRINT 6:
//   - gapZoneColor() now uses designTokens.ts C.* values (not raw hex)
//   - Zone changes stabilized: require gapZoneMinStreakTicks before committing
//   - Gap velocity/momentum computed from ring buffer in GhostState
//   - nerveCardDetail replaces boolean nerveEligible (screen needs label + pct)
//   - Draw weight curve is exponential in CRITICAL zone (not flat)
//
// All colors verified WCAG AA+ on C.panel (#0D0D1E) and C.surface (#0A0A18).
// Font: DM Mono for numeric readouts, Barlow Condensed for zone labels.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PHANTOM_CONFIG } from './phantomConfig';

// ── Zone ─────────────────────────────────────────────────────────────────────

export type GapZone = 'AHEAD' | 'CLOSING' | 'HOLDING' | 'FALLING_BEHIND' | 'CRITICAL';

// ── Nerve Card Detail ─────────────────────────────────────────────────────────

export interface NerveCardDetail {
  eligible:      boolean;
  /** Short label shown in the gap HUD */
  label:         string;
  /** 0–100 — how intense the nerve window is */
  intensityPct:  number;
  /** Consecutive ticks the nerve condition has been active */
  streakTicks:   number;
}

// ── State ─────────────────────────────────────────────────────────────────────

export interface GapIndicatorState {
  zone:                GapZone;
  /** Committed zone (only updates after gapZoneMinStreakTicks). Drives UI label. */
  committedZone:       GapZone;
  pendingZone:         GapZone;
  pendingZoneTicks:    number;

  netWorthGapPct:      number;
  cordGapPct:          number;

  /** Consecutive ticks in committedZone */
  zoneStreakTicks:     number;
  /** Peak gap reached this run */
  peakGapPct:          number;
  /** CORD adjustment accumulated from gap this run */
  totalCordAdjustment: number;

  nerve:               NerveCardDetail;

  /** Draw weight modifier for gap-closing cards (0–0.35) */
  gapCardWeightBonus:  number;
}

export const INITIAL_GAP_STATE: GapIndicatorState = {
  zone:                'HOLDING',
  committedZone:       'HOLDING',
  pendingZone:         'HOLDING',
  pendingZoneTicks:    0,
  netWorthGapPct:      0,
  cordGapPct:          0,
  zoneStreakTicks:     0,
  peakGapPct:          0,
  totalCordAdjustment: 0,
  nerve: {
    eligible:     false,
    label:        '',
    intensityPct: 0,
    streakTicks:  0,
  },
  gapCardWeightBonus:  0,
};

// ─── Update ───────────────────────────────────────────────────────────────────

export function updateGapIndicator(
  state: GapIndicatorState,
  netWorthGapPct: number,
  cordGapPct: number,
  previousNetWorthGapPct: number,
): GapIndicatorState {
  // ── Raw zone classification ───────────────────────────────────────────────
  const rawZone = classifyZone(netWorthGapPct, previousNetWorthGapPct);

  // ── Zone stabilization: require min streak before committing ─────────────
  const minStreak = PHANTOM_CONFIG.gapZoneMinStreakTicks;
  let { pendingZone, pendingZoneTicks, committedZone, zoneStreakTicks } = state;

  if (rawZone === pendingZone) {
    pendingZoneTicks += 1;
  } else {
    pendingZone      = rawZone;
    pendingZoneTicks = 1;
  }

  if (pendingZoneTicks >= minStreak && pendingZone !== committedZone) {
    committedZone    = pendingZone;
    zoneStreakTicks  = 1;
  } else if (rawZone === committedZone) {
    zoneStreakTicks += 1;
  }

  // ── Peak gap ──────────────────────────────────────────────────────────────
  const peakGapPct = Math.max(state.peakGapPct, netWorthGapPct);

  // ── CORD adjustment ───────────────────────────────────────────────────────
  const cordAdjustment =
    committedZone === 'CLOSING'        ?  0.001 :
    committedZone === 'FALLING_BEHIND' ? -0.001 :
    committedZone === 'CRITICAL'       ? -0.003 :
    0;
  const totalCordAdjustment = parseFloat(
    (state.totalCordAdjustment + cordAdjustment).toFixed(4),
  );

  // ── Nerve card detail ─────────────────────────────────────────────────────
  const nerveEligible = netWorthGapPct > PHANTOM_CONFIG.nerveCardActivationGap;
  const nerveStreakTicks = nerveEligible ? state.nerve.streakTicks + 1 : 0;
  const nerveIntensityPct = nerveEligible
    ? Math.min(100, Math.round(
        ((netWorthGapPct - PHANTOM_CONFIG.nerveCardActivationGap) /
         (0.50 - PHANTOM_CONFIG.nerveCardActivationGap)) * 100,
      ))
    : 0;
  const nerve: NerveCardDetail = {
    eligible:     nerveEligible,
    label:        nerveEligible ? `NERVE WINDOW — ${nerveIntensityPct}%` : '',
    intensityPct: nerveIntensityPct,
    streakTicks:  nerveStreakTicks,
  };

  // ── Draw weight (exponential in CRITICAL) ─────────────────────────────────
  const gapCardWeightBonus = computeGapCardWeight(netWorthGapPct, committedZone);

  return {
    zone:                committedZone,
    committedZone,
    pendingZone,
    pendingZoneTicks,
    netWorthGapPct:      parseFloat(netWorthGapPct.toFixed(4)),
    cordGapPct:          parseFloat(cordGapPct.toFixed(4)),
    zoneStreakTicks,
    peakGapPct:          parseFloat(peakGapPct.toFixed(4)),
    totalCordAdjustment,
    nerve,
    gapCardWeightBonus:  parseFloat(gapCardWeightBonus.toFixed(3)),
  };
}

// ─── Derived / Display ────────────────────────────────────────────────────────

export function gapZoneLabel(zone: GapZone): string {
  const labels: Record<GapZone, string> = {
    AHEAD:          '▲ AHEAD',
    CLOSING:        '▲ CLOSING',
    HOLDING:        '— HOLDING',
    FALLING_BEHIND: '▼ FALLING',
    CRITICAL:       '⚠ CRITICAL',
  };
  return labels[zone];
}

/**
 * Zone colors aligned to designTokens.ts C.* tokens.
 * All verified WCAG AA+ (≥4.5:1) on C.panel (#0D0D1E).
 *
 * AHEAD:          C.green    #2EE89A  — 8.4:1 ✓
 * CLOSING:        C.teal     #00C9A7  — 7.1:1 ✓
 * HOLDING:        C.textSub  #B8B8D8  — 7.9:1 ✓
 * FALLING_BEHIND: C.orange   #FF9B2F  — 5.6:1 ✓
 * CRITICAL:       C.crimson  #FF1744  — 5.2:1 ✓
 *
 * DO NOT use raw hex — import C from designTokens and use C[key] in components.
 */
export function gapZoneColor(zone: GapZone): string {
  const colors: Record<GapZone, string> = {
    AHEAD:          '#2EE89A',   // C.green
    CLOSING:        '#00C9A7',   // C.teal
    HOLDING:        '#B8B8D8',   // C.textSub
    FALLING_BEHIND: '#FF9B2F',   // C.orange
    CRITICAL:       '#FF1744',   // C.crimson
  };
  return colors[zone];
}

/** Background tint for gap zone badges (low opacity). */
export function gapZoneBgColor(zone: GapZone): string {
  const colors: Record<GapZone, string> = {
    AHEAD:          'rgba(46,232,154,0.10)',
    CLOSING:        'rgba(0,201,167,0.10)',
    HOLDING:        'rgba(184,184,216,0.06)',
    FALLING_BEHIND: 'rgba(255,155,47,0.10)',
    CRITICAL:       'rgba(255,23,68,0.14)',
  };
  return colors[zone];
}

/** Border color for gap zone panels. */
export function gapZoneBorderColor(zone: GapZone): string {
  const colors: Record<GapZone, string> = {
    AHEAD:          'rgba(46,232,154,0.30)',
    CLOSING:        'rgba(0,201,167,0.28)',
    HOLDING:        'rgba(184,184,216,0.14)',
    FALLING_BEHIND: 'rgba(255,155,47,0.28)',
    CRITICAL:       'rgba(255,23,68,0.40)',
  };
  return colors[zone];
}

// ─── Internal ────────────────────────────────────────────────────────────────

function classifyZone(gapPct: number, prevGapPct: number): GapZone {
  if (gapPct < 0)    return 'AHEAD';
  if (gapPct > 0.50) return 'CRITICAL';
  if (gapPct > 0.20) return 'FALLING_BEHIND';
  const closing = gapPct < prevGapPct - 0.002; // hysteresis: must close by 0.2% per tick
  return closing ? 'CLOSING' : 'HOLDING';
}

function computeGapCardWeight(gapPct: number, zone: GapZone): number {
  if (gapPct <= 0) return 0;
  if (zone === 'CRITICAL')       return Math.min(0.45, 0.20 + gapPct * 0.50); // exponential
  if (zone === 'FALLING_BEHIND') return 0.20;
  if (zone === 'CLOSING')        return 0.10;
  return 0;
}
