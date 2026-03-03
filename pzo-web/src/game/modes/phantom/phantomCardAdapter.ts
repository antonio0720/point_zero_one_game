// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/phantomCardAdapter.ts
// Sprint 7 — Phantom Mode Card Adapter (new)
//
// Applies Phantom-specific card draw weight modifiers:
//   1. Gap-closing cards: bonus weight when FALLING_BEHIND / CRITICAL
//   2. Nerve cards: gated by nerve eligibility window
//   3. Decay Exploit cards: bonus when facing aged legend
//   4. Dynasty cards: only appear when dynastyStack.dynastyCardsUnlocked
//   5. Prediction cards: preview ghost's next card play
//
// Card tags are string literals from cardResolver.ts.
// This adapter is pure — it returns weight multipliers, does not mutate cards.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PHANTOM_CONFIG } from './phantomConfig';
import type { GhostState }          from './ghostReplayEngine';
import type { GapIndicatorState }   from './gapIndicatorEngine';
import type { LegendRecord }        from './legendDecayModel';
import type { DynastyChallengeStack } from './dynastyChallengeStack';
import { computeDecayExploitBonus } from './legendDecayModel';

// ── Card tag constants (mirror cardResolver.ts tags) ─────────────────────────

export const PHANTOM_CARD_TAGS = {
  GAP_CLOSING:    'gap_closing',
  NERVE:          'nerve',
  DECAY_EXPLOIT:  'decay_exploit',
  DYNASTY:        'dynasty',
  PREDICTION:     'prediction',
  GHOST_ANCHOR:   'ghost_anchor',
} as const;

export type PhantomCardTag = typeof PHANTOM_CARD_TAGS[keyof typeof PHANTOM_CARD_TAGS];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PhantomCardContext {
  ghost:    GhostState;
  gap:      GapIndicatorState;
  legend:   LegendRecord;
  dynasty:  DynastyChallengeStack;
}

export interface CardWeightModifier {
  tag:        PhantomCardTag;
  multiplier: number;  // applied to base draw weight
  bonusDraw:  number;  // flat bonus added after multiplier
  blocked:    boolean; // card cannot be drawn at all
  reason:     string;  // display reason if blocked or boosted
}

// ─── Main: compute all weight modifiers for a given card tag set ──────────────

/**
 * Returns an array of modifiers — one per card tag found in the card's tags.
 * Card draw system applies the highest multiplier (not additive).
 */
export function computePhantomCardModifiers(
  cardTags: string[],
  ctx: PhantomCardContext,
): CardWeightModifier[] {
  const modifiers: CardWeightModifier[] = [];

  for (const tag of cardTags) {
    switch (tag as PhantomCardTag) {
      case PHANTOM_CARD_TAGS.GAP_CLOSING:
        modifiers.push(computeGapClosingModifier(ctx.gap, ctx.ghost));
        break;
      case PHANTOM_CARD_TAGS.NERVE:
        modifiers.push(computeNerveModifier(ctx.gap));
        break;
      case PHANTOM_CARD_TAGS.DECAY_EXPLOIT:
        modifiers.push(computeDecayExploitModifier(ctx.legend));
        break;
      case PHANTOM_CARD_TAGS.DYNASTY:
        modifiers.push(computeDynastyModifier(ctx.dynasty));
        break;
      case PHANTOM_CARD_TAGS.PREDICTION:
        modifiers.push(computePredictionModifier(ctx.ghost));
        break;
      case PHANTOM_CARD_TAGS.GHOST_ANCHOR:
        modifiers.push(computeGhostAnchorModifier(ctx.ghost));
        break;
    }
  }

  return modifiers;
}

/**
 * Collapses modifiers to a single effective multiplier.
 * A single blocked modifier blocks the card entirely.
 */
export function collapseModifiers(modifiers: CardWeightModifier[]): {
  effective: number;
  blocked: boolean;
  label: string;
} {
  if (!modifiers.length) return { effective: 1, blocked: false, label: '' };

  const blocked = modifiers.some(m => m.blocked);
  if (blocked) {
    const blockReason = modifiers.find(m => m.blocked)?.reason ?? 'Unavailable';
    return { effective: 0, blocked: true, label: blockReason };
  }

  const effective = modifiers.reduce((acc, m) => acc * m.multiplier + m.bonusDraw, 1);
  const topReason = modifiers.sort((a, b) => b.multiplier - a.multiplier)[0]?.reason ?? '';
  return { effective: Math.max(0, effective), blocked: false, label: topReason };
}

// ─── Per-tag modifier functions ───────────────────────────────────────────────

function computeGapClosingModifier(
  gap: GapIndicatorState,
  ghost: GhostState,
): CardWeightModifier {
  const zoneBonus = gap.gapCardWeightBonus;

  if (ghost.isAhead || gap.netWorthGapPct <= 0) {
    return {
      tag: PHANTOM_CARD_TAGS.GAP_CLOSING,
      multiplier: 0.5,
      bonusDraw: 0,
      blocked: false,
      reason: 'Gap closing cards suppressed — you\'re ahead',
    };
  }

  const multiplier = 1 + zoneBonus * 3;  // up to ~2.05× at CRITICAL
  return {
    tag: PHANTOM_CARD_TAGS.GAP_CLOSING,
    multiplier,
    bonusDraw: zoneBonus,
    blocked: false,
    reason: `↑ Gap-closing draw ×${multiplier.toFixed(2)} (${gap.zone})`,
  };
}

function computeNerveModifier(gap: GapIndicatorState): CardWeightModifier {
  if (!gap.nerve.eligible) {
    return {
      tag: PHANTOM_CARD_TAGS.NERVE,
      multiplier: 1,
      bonusDraw: 0,
      blocked: true,
      reason: `NERVE: gap must exceed ${Math.round(PHANTOM_CONFIG.nerveCardActivationGap * 100)}%`,
    };
  }

  const intensityFactor = gap.nerve.intensityPct / 100;
  const multiplier = 1 + intensityFactor * 1.5;
  return {
    tag: PHANTOM_CARD_TAGS.NERVE,
    multiplier,
    bonusDraw: 0,
    blocked: false,
    reason: `NERVE ACTIVE — ${gap.nerve.label}`,
  };
}

function computeDecayExploitModifier(legend: LegendRecord): CardWeightModifier {
  const bonus = computeDecayExploitBonus(legend);

  if (bonus <= 0) {
    return {
      tag: PHANTOM_CARD_TAGS.DECAY_EXPLOIT,
      multiplier: 1,
      bonusDraw: 0,
      blocked: false,
      reason: 'Legend is fresh — decay exploit minimal',
    };
  }

  return {
    tag: PHANTOM_CARD_TAGS.DECAY_EXPLOIT,
    multiplier: 1 + bonus,
    bonusDraw: bonus * 0.05,
    blocked: false,
    reason: `Decay exploit +${Math.round(bonus * 100)}% (legend age ${(1 - legend.currentDecayFactor).toFixed(2)})`,
  };
}

function computeDynastyModifier(dynasty: DynastyChallengeStack): CardWeightModifier {
  if (!dynasty.dynastyCardsUnlocked) {
    return {
      tag: PHANTOM_CARD_TAGS.DYNASTY,
      multiplier: 1,
      bonusDraw: 0,
      blocked: true,
      reason: `DYNASTY: requires ${2 - dynasty.depth} more challengers in queue`,
    };
  }

  const depthBonus = Math.min(0.50, (dynasty.depth - 1) * 0.10);
  return {
    tag: PHANTOM_CARD_TAGS.DYNASTY,
    multiplier: 1 + depthBonus,
    bonusDraw: 0,
    blocked: false,
    reason: `DYNASTY stack depth ${dynasty.depth} — pressure ×${(1 + depthBonus).toFixed(2)}`,
  };
}

function computePredictionModifier(ghost: GhostState): CardWeightModifier {
  if (!ghost.timeline) {
    return {
      tag: PHANTOM_CARD_TAGS.PREDICTION,
      multiplier: 1,
      bonusDraw: 0,
      blocked: true,
      reason: 'No ghost timeline loaded',
    };
  }

  return {
    tag: PHANTOM_CARD_TAGS.PREDICTION,
    multiplier: 1.2,
    bonusDraw: 0,
    blocked: false,
    reason: `Prediction window: ${PHANTOM_CONFIG.predictionRevealWindowTicks} ticks ahead`,
  };
}

function computeGhostAnchorModifier(ghost: GhostState): CardWeightModifier {
  // Ghost anchor cards are stronger the more ahead the ghost is
  const gapPct = Math.max(0, ghost.netWorthGapPct);
  const multiplier = 1 + Math.min(0.50, gapPct * 1.5);

  return {
    tag: PHANTOM_CARD_TAGS.GHOST_ANCHOR,
    multiplier,
    bonusDraw: 0,
    blocked: false,
    reason: `Ghost anchor ×${multiplier.toFixed(2)} (gap ${(gapPct * 100).toFixed(1)}%)`,
  };
}
