/**
 * DivergenceEngine — src/ml/DivergenceEngine.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #5: Ghost Divergence Attribution
 *
 * After a Phantom run, produces a 3-cause forensic verdict:
 *   1. Timing delta    — missed GBM windows / slow decision speed
 *   2. Selection delta — wrong card class for context
 *   3. Resilience delta — failed to exploit Silver breach points
 *
 * FIX: causes array now uses `satisfies DivergenceCause[]` so literal
 * union types ('TIMING' | 'SELECTION' | 'RESILIENCE') are preserved
 * through the .sort() call. Eliminates TS2322.
 */

import type { GhostCheckpoint } from './PhantomGhostEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerCheckpoint {
  tick:      number;
  netWorth:  number;
  cashflow:  number;
  cordScore: number;
  phase:     string;
}

export interface DivergenceCause {
  type:        'TIMING' | 'SELECTION' | 'RESILIENCE';
  label:       string;
  gapAmount:   number;
  gapPct:      number;
  keyTick:     number;
  explanation: string;
  drill:       string;
}

export interface DivergenceVerdict {
  totalGap:     number;
  netWorthGap:  number;
  causes:       DivergenceCause[];
  primaryCause: DivergenceCause;
  headline:     string;
  recoverable:  boolean;
}

export interface DivergenceInput {
  playerCheckpoints:     PlayerCheckpoint[];
  ghostCheckpoints:      GhostCheckpoint[];
  windowsMissed:         number;
  windowsResolved:       number;
  avgResponseMs:         number;
  wrongZonePlays:        number;
  correctZonePlays:      number;
  fubarHits:             number;
  fubarsAbsorbed:        number;
  wasEverInDistress:     boolean;
  recoveredFromDistress: boolean;
  totalTicks:            number;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function computeDivergence(input: DivergenceInput): DivergenceVerdict {
  const lastPlayer = input.playerCheckpoints[input.playerCheckpoints.length - 1];
  const lastGhost  = input.ghostCheckpoints[input.ghostCheckpoints.length - 1];

  if (!lastPlayer || !lastGhost) {
    return emptyVerdict();
  }

  const totalGap    = Math.max(0, lastGhost.cordScore - lastPlayer.cordScore);
  const netWorthGap = Math.max(0, lastGhost.netWorth  - lastPlayer.netWorth);

  // ── Timing Delta ──────────────────────────────────────────────────────────
  const totalWindows = input.windowsMissed + input.windowsResolved;
  const missRate     = totalWindows > 0 ? input.windowsMissed / totalWindows : 0;
  const speedScore   = Math.max(0, 1 - input.avgResponseMs / 8000);
  const timingScore  = missRate * 0.6 + (1 - speedScore) * 0.4;
  const timingGap    = Math.round(totalGap * timingScore * 0.45);

  // ── Selection Delta ───────────────────────────────────────────────────────
  const totalPlays   = input.wrongZonePlays + input.correctZonePlays;
  const wrongRate    = totalPlays > 0 ? input.wrongZonePlays / totalPlays : 0;
  const selectionGap = Math.round(totalGap * wrongRate * 0.35);

  // ── Resilience Delta ──────────────────────────────────────────────────────
  const absorptionRate  = input.fubarHits > 0
    ? 1 - input.fubarsAbsorbed / input.fubarHits
    : 0;
  const distressPenalty = input.wasEverInDistress && !input.recoveredFromDistress ? 0.4 : 0;
  const resilienceScore = absorptionRate * 0.6 + distressPenalty * 0.4;
  const resilienceGap   = Math.round(totalGap * resilienceScore * 0.30);

  // ── Normalize to totalGap ─────────────────────────────────────────────────
  const rawSum      = timingGap + selectionGap + resilienceGap;
  const norm        = rawSum > 0 ? totalGap / rawSum : 1;
  const timingGapN  = Math.round(timingGap * norm);
  const selectGapN  = Math.round(selectionGap * norm);
  const resilGapN   = totalGap - timingGapN - selectGapN;

  const timingKeyTick = findDivergenceTick(
    input.playerCheckpoints, input.ghostCheckpoints, 0.3,
  );

  // ── FIX: `satisfies DivergenceCause[]` preserves literal union through sort
  const causes: DivergenceCause[] = (
    [
      {
        type:        'TIMING' as const,
        label:       'Decision Window Timing',
        gapAmount:   timingGapN,
        gapPct:      totalGap > 0 ? timingGapN / totalGap : 0,
        keyTick:     timingKeyTick,
        explanation: `Missed ${input.windowsMissed} decision window(s). ` +
                     `Average response: ${Math.round(input.avgResponseMs)}ms. ` +
                     `Ghost resolved at ~2000ms avg.`,
        drill:       'Practice Tier 3 windows under pressure until avg response < 3s',
      },
      {
        type:        'SELECTION' as const,
        label:       'Card Zone Selection',
        gapAmount:   selectGapN,
        gapPct:      totalGap > 0 ? selectGapN / totalGap : 0,
        keyTick:     findDivergenceTick(input.playerCheckpoints, input.ghostCheckpoints, 0.5),
        explanation: `${input.wrongZonePlays} cards played in suboptimal zones ` +
                     `(${Math.round(wrongRate * 100)}% wrong-zone rate). ` +
                     `Ghost matched zone 94%+ of the time.`,
        drill:       'Enable zone affinity hints and review BUILD vs SCALE decision criteria',
      },
      {
        type:        'RESILIENCE' as const,
        label:       'Shock Absorption',
        gapAmount:   resilGapN,
        gapPct:      totalGap > 0 ? resilGapN / totalGap : 0,
        keyTick:     findDivergenceTick(input.playerCheckpoints, input.ghostCheckpoints, 0.7),
        explanation: input.wasEverInDistress && !input.recoveredFromDistress
          ? `Entered distress and did not recover. Ghost never entered distress. ` +
            `${input.fubarHits} FUBAR hits taken.`
          : `${input.fubarHits - input.fubarsAbsorbed} unabsorbed FUBAR hits created gap. ` +
            `Ghost had full mitigation coverage.`,
        drill:       'Build emergency fund + insurance mitigation before Tier 3 activates',
      },
    ] satisfies DivergenceCause[]
  ).sort((a, b) => b.gapAmount - a.gapAmount);

  const primaryCause = causes[0];
  const recoverable  = primaryCause.gapPct > 0.4;

  return {
    totalGap,
    netWorthGap,
    causes,
    primaryCause,
    headline: `You fell behind because of ${primaryCause.label.toLowerCase()} — starting at tick ${primaryCause.keyTick}.`,
    recoverable,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findDivergenceTick(
  player:    PlayerCheckpoint[],
  ghost:     GhostCheckpoint[],
  threshold: number,
): number {
  for (let i = 0; i < Math.min(player.length, ghost.length); i++) {
    const gap        = ghost[i].cordScore - player[i].cordScore;
    const ghostScore = ghost[i].cordScore;
    if (ghostScore > 0 && gap / ghostScore > threshold) {
      return player[i].tick;
    }
  }
  return player[Math.floor(player.length / 2)]?.tick ?? 0;
}

function emptyVerdict(): DivergenceVerdict {
  const empty: DivergenceCause = {
    type:        'TIMING',
    label:       'N/A',
    gapAmount:   0,
    gapPct:      0,
    keyTick:     0,
    explanation: 'Insufficient data',
    drill:       '',
  };
  return {
    totalGap:     0,
    netWorthGap:  0,
    causes:       [empty, empty, empty],
    primaryCause: empty,
    headline:     'Insufficient run data for divergence analysis.',
    recoverable:  false,
  };
}