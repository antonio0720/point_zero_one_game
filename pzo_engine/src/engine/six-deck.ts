// ============================================================
// POINT ZERO ONE DIGITAL — Six-Deck DrawMix Engine
// Sprint 8 / Phase 1 Upgrade
//
// Replaces the legacy DeckReactorImpl which:
//   - Used Math.random() (non-deterministic — breaks replay)
//   - Used crypto.randomUUID() (browser API — crashes Node)
//   - Referenced Deck.IP (typo — doesn't exist)
//   - Had ML branch that referenced a null model
//
// DrawMix is now:
//   - Fully deterministic via SeededRandom (Mulberry32)
//   - Mode-aware: each GameMode gets adjusted deck weights
//   - Pressure-aware: FUBAR injection scales with creditTightness
//   - Consecutive-pass aware: sustained passes increase MISSED_OPPORTUNITY
//   - Phase-aware: PRIVILEGED cards rarer in FOUNDATION, more in SOVEREIGNTY
//
// Deploy to: pzo_engine/src/engine/six-deck.ts
// ============================================================

import { SeededRandom }  from './market-engine';
import {
  BaseDeckType,
  GameMode,
  RunPhase,
  type CardInHand,
} from './types';
import { CARD_REGISTRY, toCardInHand } from './deck';

// ─── DRAW MIX WEIGHTS ────────────────────────────────────────

/**
 * Base deck selection weights for GO_ALONE (Empire) mode.
 * All other modes are computed by applying deltas to this base.
 *
 * Weights are relative probability mass — they don't need to sum to 1;
 * DrawMix normalises them internally.
 */
const BASE_WEIGHTS: Record<BaseDeckType, number> = {
  [BaseDeckType.OPPORTUNITY]:    0.40,
  [BaseDeckType.IPA]:            0.25,
  [BaseDeckType.FUBAR]:          0.15,
  [BaseDeckType.PRIVILEGED]:     0.10,
  [BaseDeckType.SO]:             0.08,
  [BaseDeckType.PHASE_BOUNDARY]: 0.02,
};

/**
 * Per-mode weight deltas applied on top of BASE_WEIGHTS.
 * Positive values increase probability; negative decrease.
 */
const MODE_WEIGHT_DELTAS: Record<GameMode, Partial<Record<BaseDeckType, number>>> = {
  'GO_ALONE': {}, // no delta — this IS the base

  'HEAD_TO_HEAD': {
    [BaseDeckType.FUBAR]:      +0.08,  // more chaos in PvP
    [BaseDeckType.PRIVILEGED]: +0.05,  // insider deals help attack
    [BaseDeckType.OPPORTUNITY]:-0.08,  // fewer passive builds
    [BaseDeckType.IPA]:        -0.05,
  },

  'TEAM_UP': {
    [BaseDeckType.OPPORTUNITY]: +0.05, // collaboration expands deal flow
    [BaseDeckType.IPA]:         +0.05,
    [BaseDeckType.FUBAR]:       -0.05, // team provides buffer
    [BaseDeckType.SO]:          +0.05, // systemic obstacles test trust
  },

  'CHASE_A_LEGEND': {
    [BaseDeckType.PHASE_BOUNDARY]: +0.05, // legend run is phase-driven
    [BaseDeckType.PRIVILEGED]:     +0.05, // legends get access
    [BaseDeckType.FUBAR]:          +0.03, // ghosts haunt you
    [BaseDeckType.OPPORTUNITY]:    -0.08,
  },
};

/**
 * Per-phase adjustments on top of mode weights.
 * Applied additively to the mode-adjusted weights.
 */
const PHASE_WEIGHT_DELTAS: Record<RunPhase, Partial<Record<BaseDeckType, number>>> = {
  'FOUNDATION': {
    [BaseDeckType.OPPORTUNITY]:    +0.05,  // easier entry in early game
    [BaseDeckType.PRIVILEGED]:     -0.05,  // inner circle not yet accessible
    [BaseDeckType.PHASE_BOUNDARY]: -0.01,
  },
  'ESCALATION': {},                          // no adjustment — midgame neutral
  'SOVEREIGNTY': {
    [BaseDeckType.PRIVILEGED]:     +0.08,  // sovereignty-tier access unlocks
    [BaseDeckType.FUBAR]:          +0.05,  // higher stakes = more chaos
    [BaseDeckType.OPPORTUNITY]:    -0.08,  // fewer basic deals
    [BaseDeckType.PHASE_BOUNDARY]: +0.05,
  },
};

// ─── DRAW MIX RESULT ─────────────────────────────────────────

export interface DrawMixResult {
  deckType:         BaseDeckType;
  selectionWeight:  number;    // weight used for this selection (audit)
  auditSnapshot:    Record<BaseDeckType, number>; // full normalised weights at selection time
}

// ─── DRAW MIX ENGINE ─────────────────────────────────────────

export class DrawMixEngine {
  private readonly rng: SeededRandom;

  constructor(rng: SeededRandom) {
    this.rng = rng;
  }

  /**
   * Select a deck type for the next draw.
   * Fully deterministic — same rng state → same selection.
   *
   * @param gameMode          - Current game mode
   * @param runPhase          - Current run phase
   * @param consecutivePasses - How many turns player has passed in a row
   * @param creditTightness   - 0.0–1.0 macro credit pressure
   */
  selectDeck(
    gameMode:          GameMode,
    runPhase:          RunPhase,
    consecutivePasses: number,
    creditTightness:   number,
  ): DrawMixResult {
    const weights = this._computeWeights(gameMode, runPhase, consecutivePasses, creditTightness);
    const total   = Object.values(weights).reduce((s, w) => s + w, 0);

    // Normalise
    const normalised: Record<BaseDeckType, number> = {} as any;
    for (const [k, v] of Object.entries(weights) as [BaseDeckType, number][]) {
      normalised[k] = v / total;
    }

    // Weighted random selection using Mulberry32
    const roll     = this.rng.next();
    let cumulative = 0;
    let selected   = BaseDeckType.OPPORTUNITY;
    let selectedWeight = normalised[BaseDeckType.OPPORTUNITY];

    for (const [deckType, weight] of Object.entries(normalised) as [BaseDeckType, number][]) {
      cumulative += weight;
      if (roll <= cumulative) {
        selected       = deckType;
        selectedWeight = weight;
        break;
      }
    }

    return {
      deckType:        selected,
      selectionWeight: selectedWeight,
      auditSnapshot:   normalised,
    };
  }

  /**
   * Pull a card from a typed sub-pool for the given deck type.
   * If no cards exist for the deck type, falls back to OPPORTUNITY.
   */
  drawFromDeck(
    deckType: BaseDeckType,
    drawPile: CardInHand[],
    tick:     number,
  ): CardInHand | null {
    const eligible = drawPile.filter(c => c.definition.deckType === deckType);
    if (eligible.length === 0) {
      // fallback: any card from draw pile
      return drawPile.length > 0 ? drawPile[0] : null;
    }
    // Draw from top of eligible pile (already seeded-shuffled at session start)
    const idx  = Math.floor(this.rng.next() * eligible.length);
    return eligible[idx] ?? null;
  }

  // ─── PRIVATE ───────────────────────────────────────────────

  private _computeWeights(
    gameMode:          GameMode,
    runPhase:          RunPhase,
    consecutivePasses: number,
    creditTightness:   number,
  ): Record<BaseDeckType, number> {
    // Start from base
    const weights: Record<BaseDeckType, number> = { ...BASE_WEIGHTS };

    // Apply mode deltas
    const modeDeltas = MODE_WEIGHT_DELTAS[gameMode];
    for (const [k, v] of Object.entries(modeDeltas) as [BaseDeckType, number][]) {
      weights[k] = Math.max(0.01, (weights[k] ?? 0) + v);
    }

    // Apply phase deltas
    const phaseDeltas = PHASE_WEIGHT_DELTAS[runPhase];
    for (const [k, v] of Object.entries(phaseDeltas) as [BaseDeckType, number][]) {
      weights[k] = Math.max(0.01, (weights[k] ?? 0) + v);
    }

    // Pressure adjustment: high credit tightness → more FUBAR, less PRIVILEGED
    if (creditTightness > 0.5) {
      const pressureFactor = (creditTightness - 0.5) * 2; // 0.0–1.0
      weights[BaseDeckType.FUBAR]      = Math.min(0.40, weights[BaseDeckType.FUBAR] + pressureFactor * 0.12);
      weights[BaseDeckType.SO]         = Math.min(0.25, weights[BaseDeckType.SO] + pressureFactor * 0.06);
      weights[BaseDeckType.PRIVILEGED] = Math.max(0.02, weights[BaseDeckType.PRIVILEGED] - pressureFactor * 0.05);
      weights[BaseDeckType.OPPORTUNITY]= Math.max(0.10, weights[BaseDeckType.OPPORTUNITY] - pressureFactor * 0.08);
    }

    // Consecutive pass penalty: draws increase MISSED_OPPORTUNITY proxy via FUBAR
    if (consecutivePasses >= 3) {
      const passFactor = Math.min(consecutivePasses - 2, 5) * 0.04;
      weights[BaseDeckType.FUBAR] = Math.min(0.50, weights[BaseDeckType.FUBAR] + passFactor);
      weights[BaseDeckType.OPPORTUNITY] = Math.max(0.05, weights[BaseDeckType.OPPORTUNITY] - passFactor);
    }

    return weights;
  }
}

// ─── FORCED CARD INJECTOR ────────────────────────────────────

/**
 * Injects special engine-driven cards (FUBAR, phase boundary, hater bots)
 * into the draw result without consuming the player's draw.
 *
 * Returns null if no injection is warranted this tick.
 */
export function maybeInjectForcedCard(
  tick:            number,
  rng:             SeededRandom,
  creditTightness: number,
  haterHeat:       number,
): CardInHand | null {
  // Random FUBAR injection: scales with credit tightness
  if (rng.chance(creditTightness * 0.08)) {
    const fubarCards = Object.values(CARD_REGISTRY).filter(
      d => d.deckType === BaseDeckType.FUBAR,
    );
    if (fubarCards.length === 0) return null;
    const idx = rng.nextInt(0, fubarCards.length - 1);
    const card = toCardInHand(fubarCards[idx], tick, rng);
    return { ...card, forcedEntry: true, forcedSource: 'CREDIT_PRESSURE' };
  }

  // Hater-triggered FUBAR: when heat is high
  if (haterHeat >= 70 && rng.chance(0.12)) {
    const fubarCards = Object.values(CARD_REGISTRY).filter(
      d => d.deckType === BaseDeckType.FUBAR,
    );
    if (fubarCards.length === 0) return null;
    const idx = rng.nextInt(0, fubarCards.length - 1);
    const card = toCardInHand(fubarCards[idx], tick, rng);
    return { ...card, forcedEntry: true, forcedSource: 'HATER_HEAT' };
  }

  return null;
}