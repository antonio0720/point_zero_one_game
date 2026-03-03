// ============================================================
// POINT ZERO ONE DIGITAL — Moment Forge
// Sprint 8 / Phase 1 Upgrade
//
// Moment Forge classifies significant gameplay events into
// named "moment" types for narrative labeling and analytics.
// These moment labels surface in TurnEvent payloads and are
// stored with run records for leaderboard / replay display.
//
// FIXES FROM SPRINT 0:
//   - `crypto.createHash` was referenced without import → crashed Node
//   - ML branch referenced a never-instantiated model → dead code removed
//   - `moment_forge_rules` is now an exported const (testable)
//   - get_moment_forge is now deterministic (no side effects)
//   - Added BLEED_SURVIVED, FREEDOM_ACHIEVED, SYNDICATE_BETRAYAL moments
//
// Deploy to: pzo_engine/src/engine/moment-forge.ts
// ============================================================

import { createHash } from 'crypto';

// ─── MOMENT TYPES ────────────────────────────────────────────

export enum MomentForge {
  // Core gameplay moments
  FUBAR_KILLED_ME      = 'FUBAR_KILLED_ME',       // shield failed + equity wiped
  OPPORTUNITY_FLIP     = 'OPPORTUNITY_FLIP',       // high-ROI deal closed fast
  MISSED_THE_BAG       = 'MISSED_THE_BAG',         // passed on a positive-ROI deal

  // Empire / GO_ALONE specific
  BLEED_SURVIVED       = 'BLEED_SURVIVED',         // survived bleed mode critical
  FREEDOM_ACHIEVED     = 'FREEDOM_ACHIEVED',       // passive income crossed expense line

  // Predator / HEAD_TO_HEAD specific
  BATTLE_BUDGET_MAXED  = 'BATTLE_BUDGET_MAXED',    // full battle budget consumed
  OPPONENT_WIPED       = 'OPPONENT_WIPED',         // opponent hit bankruptcy

  // Syndicate / TEAM_UP specific
  SYNDICATE_BETRAYAL   = 'SYNDICATE_BETRAYAL',     // defection card played
  TRUST_CEILING        = 'TRUST_CEILING',          // trust score hit max

  // Phantom / CHASE_A_LEGEND specific
  GHOST_DELTA_POSITIVE = 'GHOST_DELTA_POSITIVE',   // ahead of legend pace
  LEGEND_PASSED        = 'LEGEND_PASSED',          // net worth exceeded legend benchmark
}

// ─── MOMENT FORGE RULES ──────────────────────────────────────

export interface MomentForgeRules {
  shieldFailureThreshold: number;  // min equity damage % to trigger FUBAR_KILLED_ME
  damageEquityThreshold:  number;  // min equity damage ratio
  opportunityRoiThreshold:number;  // min ROI% for OPPORTUNITY_FLIP
  opportunityTickThreshold:number; // max ticks from draw to play for OPPORTUNITY_FLIP
  missedBagRoiThreshold:  number;  // min ROI% for MISSED_THE_BAG
  bleedCashThreshold:     number;  // cash level to tag BLEED_SURVIVED
}

export const MOMENT_FORGE_RULES: MomentForgeRules = {
  shieldFailureThreshold:  0.20,   // shield absorbed ≥ 20% equity damage
  damageEquityThreshold:   0.20,   // FUBAR cashDelta ≥ 20% of net worth
  opportunityRoiThreshold: 0.15,   // incomeDelta / cost ≥ 15%
  opportunityTickThreshold:30,     // resolved within 30 ticks of draw
  missedBagRoiThreshold:   0.10,   // passed deal would have yielded ≥ 10%
  bleedCashThreshold:      5_000,  // survived with cash < $5,000
} as const;

// ─── MOMENT CLASSIFIER ───────────────────────────────────────

/**
 * Classify a turn outcome into a MomentForge label.
 * Pure function — same inputs always produce same output.
 * Returns null if no notable moment occurred this turn.
 *
 * @param shieldFailed     - Did a FUBAR card bypass/destroy shields?
 * @param damageEquity     - Ratio of cashDelta to net worth (absolute)
 * @param dealRoi          - incomeDelta / cost for the card played (0.0–∞)
 * @param ticksElapsed     - Ticks from card draw to resolution
 * @param cash             - Player cash at end of turn (for bleed check)
 * @param isWin            - Did the player win this turn?
 * @param isDefection      - Did a DEFECTION card get played?
 * @param trustScore       - Current trust score (TEAM_UP)
 * @param ghostDelta       - Current ghost delta (CHASE_A_LEGEND)
 */
export function classifyMoment(opts: {
  shieldFailed:  boolean;
  damageEquity:  number;
  dealRoi:       number;
  ticksElapsed:  number;
  cash:          number;
  isWin:         boolean;
  isDefection?:  boolean;
  trustScore?:   number;
  ghostDelta?:   number;
}): MomentForge | null {
  const r = MOMENT_FORGE_RULES;

  // Win moments first (highest priority)
  if (opts.isWin) return MomentForge.FREEDOM_ACHIEVED;

  // FUBAR moment: shield failed and equity damage was significant
  if (opts.shieldFailed && opts.damageEquity > r.damageEquityThreshold) {
    return MomentForge.FUBAR_KILLED_ME;
  }

  // Opportunity flip: high ROI deal resolved quickly
  if (
    opts.dealRoi  > r.opportunityRoiThreshold &&
    opts.ticksElapsed < r.opportunityTickThreshold
  ) {
    return MomentForge.OPPORTUNITY_FLIP;
  }

  // Missed the bag: player passed on a good deal
  if (opts.dealRoi > r.missedBagRoiThreshold && opts.dealRoi <= r.opportunityRoiThreshold) {
    return MomentForge.MISSED_THE_BAG;
  }

  // Bleed survived: player in critical cash zone but still alive
  if (opts.cash > 0 && opts.cash < r.bleedCashThreshold) {
    return MomentForge.BLEED_SURVIVED;
  }

  // Syndicate betrayal
  if (opts.isDefection) return MomentForge.SYNDICATE_BETRAYAL;

  // Trust ceiling
  if ((opts.trustScore ?? 0) >= 0.95) return MomentForge.TRUST_CEILING;

  // Ghost delta positive
  if ((opts.ghostDelta ?? 0) > 0) return MomentForge.GHOST_DELTA_POSITIVE;

  return null;
}

// ─── MOMENT AUDIT HASH ───────────────────────────────────────

/**
 * Compute a deterministic hash for a moment event.
 * Attached to the TurnEvent payload for replay verification.
 */
export function momentAuditHash(
  moment:     MomentForge,
  turnNumber: number,
  tickIndex:  number,
  runSeed:    number,
): string {
  return createHash('sha256')
    .update(JSON.stringify({ moment, turnNumber, tickIndex, runSeed }))
    .digest('hex')
    .slice(0, 20);
}

// ─── MOMENT LABEL BUILDER ────────────────────────────────────

/**
 * Human-readable label for UI / leaderboard display.
 * Replaces the ad-hoc string templates scattered in turn-engine.
 */
export function momentLabel(moment: MomentForge, contextLabel = ''): string {
  const labels: Record<MomentForge, string> = {
    [MomentForge.FUBAR_KILLED_ME]:      `FUBAR_KILLED_ME: ${contextLabel}`,
    [MomentForge.OPPORTUNITY_FLIP]:     `OPPORTUNITY_FLIP: ${contextLabel || 'Deal closed fast'}`,
    [MomentForge.MISSED_THE_BAG]:       `MISSED_THE_BAG: ${contextLabel || 'Passed on value'}`,
    [MomentForge.BLEED_SURVIVED]:       `BLEED_SURVIVED: Cash critical — still standing`,
    [MomentForge.FREEDOM_ACHIEVED]:     `FREEDOM_ACHIEVED: Escaped the rat race`,
    [MomentForge.BATTLE_BUDGET_MAXED]:  `BATTLE_BUDGET_MAXED: ${contextLabel}`,
    [MomentForge.OPPONENT_WIPED]:       `OPPONENT_WIPED: ${contextLabel}`,
    [MomentForge.SYNDICATE_BETRAYAL]:   `SYNDICATE_BETRAYAL: ${contextLabel || 'Defection executed'}`,
    [MomentForge.TRUST_CEILING]:        `TRUST_CEILING: Max trust achieved`,
    [MomentForge.GHOST_DELTA_POSITIVE]: `GHOST_DELTA_POSITIVE: Ahead of legend pace`,
    [MomentForge.LEGEND_PASSED]:        `LEGEND_PASSED: ${contextLabel}`,
  };
  return labels[moment] ?? `MOMENT: ${moment}`;
}