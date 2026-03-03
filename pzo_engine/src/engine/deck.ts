// ============================================================
// POINT ZERO ONE DIGITAL — 6-Deck PZO Draw System
// Sprint 8 / Phase 1 Upgrade
//
// Replaces the old trading-card deck (BULL_CALL, BEAR_RAID etc.)
// with the canonical 6-deck PZO system.
//
// Deck types: OPPORTUNITY, IPA, FUBAR, PRIVILEGED, SO,
//             MISSED_OPPORTUNITY, PHASE_BOUNDARY (+ mode decks)
//
// All shuffles use SeededRandom — never Math.random().
//
// Deploy to: pzo_engine/src/engine/deck.ts
// ============================================================

import { createHash }   from 'crypto';
import { SeededRandom } from './market-engine';
import {
  BaseDeckType,
  ModeDeckType,
  CardRarity,
  TimingClass,
  type DeckType,
  type GameMode,
  type CardDefinition,
  type CardInHand,
  type CardBaseEffect,
} from './types';

// ─── CARD REGISTRY ───────────────────────────────────────────
// Starter cards for each deck type.
// Full 150-mechanic catalog lives in src/mechanics/.
// Registry entries are immutable base definitions.

export const CARD_REGISTRY: Record<string, CardDefinition> = {
  // ── OPPORTUNITY DECK ─────────────────────────────────────
  'opportunity_rental_001': {
    cardId:           'opportunity_rental_001',
    name:             'Rental Property',
    deckType:         BaseDeckType.OPPORTUNITY,
    rarity:           CardRarity.COMMON,
    timingClass:      TimingClass.STANDARD,
    base_cost:        5_000,
    base_effect:      { cashDelta: -5_000, incomeDelta: 500, cordDeltaBasis: 0.02 },
    tags:             ['income', 'compounding', 'real_world_finance'],
    educational_note: 'Rental income generates passive cash flow monthly.',
  },
  'opportunity_business_001': {
    cardId:           'opportunity_business_001',
    name:             'Launch Business',
    deckType:         BaseDeckType.OPPORTUNITY,
    rarity:           CardRarity.RARE,
    timingClass:      TimingClass.HOLD,
    base_cost:        8_000,
    base_effect:      { cashDelta: -8_000, incomeDelta: 1_200, cordDeltaBasis: 0.04 },
    tags:             ['income', 'automation', 'leverage'],
    educational_note: 'Businesses multiply your labor beyond hourly constraints.',
  },
  'opportunity_stock_001': {
    cardId:           'opportunity_stock_001',
    name:             'Equity Stake',
    deckType:         BaseDeckType.OPPORTUNITY,
    rarity:           CardRarity.UNCOMMON,
    timingClass:      TimingClass.STANDARD,
    base_cost:        2_000,
    base_effect:      { cashDelta: -2_000, incomeDelta: 120, cordDeltaBasis: 0.01 },
    tags:             ['compounding', 'capital_allocation'],
    educational_note: 'Equity ownership compounds wealth over time.',
  },

  // ── IPA DECK (Income-Producing Assets) ───────────────────
  'ipa_multifamily_001': {
    cardId:           'ipa_multifamily_001',
    name:             'Multi-Family Unit',
    deckType:         BaseDeckType.IPA,
    rarity:           CardRarity.EPIC,
    timingClass:      TimingClass.HOLD,
    base_cost:        15_000,
    base_effect:      { cashDelta: -15_000, incomeDelta: 2_500, cordDeltaBasis: 0.07 },
    tags:             ['income', 'compounding', 'real_world_finance', 'capital_allocation'],
    educational_note: 'Multi-unit residential properties generate compounding income streams.',
  },
  'ipa_franchise_001': {
    cardId:           'ipa_franchise_001',
    name:             'Franchise Rights',
    deckType:         BaseDeckType.IPA,
    rarity:           CardRarity.RARE,
    timingClass:      TimingClass.STANDARD,
    base_cost:        10_000,
    base_effect:      { cashDelta: -10_000, incomeDelta: 1_800, cordDeltaBasis: 0.05 },
    tags:             ['automation', 'leverage', 'income'],
    educational_note: 'A franchise leverages a proven system for recurring revenue.',
  },
  'ipa_digital_001': {
    cardId:           'ipa_digital_001',
    name:             'Digital Product',
    deckType:         BaseDeckType.IPA,
    rarity:           CardRarity.UNCOMMON,
    timingClass:      TimingClass.IMMEDIATE,
    base_cost:        1_000,
    base_effect:      { cashDelta: -1_000, incomeDelta: 400, cordDeltaBasis: 0.03 },
    tags:             ['automation', 'income', 'real_world_finance'],
    educational_note: 'Digital products scale without proportional labor cost.',
  },

  // ── FUBAR DECK (Market Reality) ───────────────────────────
  'fubar_audit_001': {
    cardId:           'fubar_audit_001',
    name:             'Tax Audit',
    deckType:         BaseDeckType.FUBAR,
    rarity:           CardRarity.COMMON,
    timingClass:      TimingClass.FORCED,
    base_cost:        0,
    base_effect:      { cashDelta: -2_500, freezeTicks: 5, cordDeltaBasis: -0.03 },
    tags:             ['real_world_finance'],
    educational_note: 'Audits are random events every operator must weather.',
  },
  'fubar_vacancy_001': {
    cardId:           'fubar_vacancy_001',
    name:             'Vacancy Crisis',
    deckType:         BaseDeckType.FUBAR,
    rarity:           CardRarity.UNCOMMON,
    timingClass:      TimingClass.FORCED,
    base_cost:        0,
    base_effect:      { incomeDelta: -600, durationTicks: 30, cordDeltaBasis: -0.02 },
    tags:             ['real_world_finance'],
    educational_note: 'Income-producing assets carry vacancy risk.',
  },
  'fubar_rate_hike_001': {
    cardId:           'fubar_rate_hike_001',
    name:             'Rate Hike',
    deckType:         BaseDeckType.FUBAR,
    rarity:           CardRarity.RARE,
    timingClass:      TimingClass.FORCED,
    base_cost:        0,
    base_effect:      { expensesDelta: 400, durationTicks: 60, cordDeltaBasis: -0.04 },
    tags:             ['real_world_finance'],
    educational_note: 'Rising rates increase debt service across all leveraged positions.',
  },

  // ── PRIVILEGED DECK ───────────────────────────────────────
  'privileged_network_001': {
    cardId:           'privileged_network_001',
    name:             'Inner Circle Deal',
    deckType:         BaseDeckType.PRIVILEGED,
    rarity:           CardRarity.EPIC,
    timingClass:      TimingClass.LEGENDARY,
    base_cost:        0,
    base_effect:      { cashDelta: 5_000, incomeDelta: 800, haterHeatDelta: 15, cordDeltaBasis: 0.06 },
    tags:             ['leverage', 'capital_allocation', 'privileged'],
    educational_note: 'Insider access creates asymmetric opportunity — and attracts attention.',
  },
  'privileged_mentor_001': {
    cardId:           'privileged_mentor_001',
    name:             'Mentor Intro',
    deckType:         BaseDeckType.PRIVILEGED,
    rarity:           CardRarity.RARE,
    timingClass:      TimingClass.STANDARD,
    base_cost:        0,
    base_effect:      { incomeDelta: 300, cordDeltaBasis: 0.04, haterHeatDelta: 5 },
    tags:             ['income', 'compounding'],
    educational_note: 'A strong mentor compresses years of learning.',
  },

  // ── SO DECK (Systemic Obstacle) ───────────────────────────
  'so_market_crash_001': {
    cardId:           'so_market_crash_001',
    name:             'Market Correction',
    deckType:         BaseDeckType.SO,
    rarity:           CardRarity.RARE,
    timingClass:      TimingClass.FORCED,
    base_cost:        0,
    base_effect:      { cashDelta: -3_000, cordDeltaBasis: -0.05 },
    tags:             ['real_world_finance'],
    educational_note: 'Markets correct — operators who survive are prepared.',
  },
  'so_regulation_001': {
    cardId:           'so_regulation_001',
    name:             'New Regulation',
    deckType:         BaseDeckType.SO,
    rarity:           CardRarity.UNCOMMON,
    timingClass:      TimingClass.FORCED,
    base_cost:        0,
    base_effect:      { expensesDelta: 200, durationTicks: 45, cordDeltaBasis: -0.02 },
    tags:             ['real_world_finance'],
    educational_note: 'Regulatory shifts create asymmetric disruption across industries.',
  },
};

// ─── DECK COMPOSITION ────────────────────────────────────────
/**
 * Base draw weights per deck type for GO_ALONE / base mode.
 * DrawMix in six-deck.ts applies mode + pressure modifiers on top.
 */
export const BASE_DECK_WEIGHTS: Record<BaseDeckType, number> = {
  [BaseDeckType.OPPORTUNITY]:    0.40,
  [BaseDeckType.IPA]:            0.25,
  [BaseDeckType.FUBAR]:          0.15,
  [BaseDeckType.PRIVILEGED]:     0.10,
  [BaseDeckType.SO]:             0.08,
  [BaseDeckType.PHASE_BOUNDARY]: 0.02,
};

// ─── DECK BUILDER ────────────────────────────────────────────
/**
 * Builds the starting hand pool for a given mode.
 * Returns a seeded-shuffled draw pile of CardInHand instances.
 */
export function buildStartingDeck(
  mode: GameMode,
  rng:  SeededRandom,
): CardInHand[] {
  const pool: CardDefinition[] = [];

  // Add OPPORTUNITY cards (3 copies for starter deck)
  pool.push(
    CARD_REGISTRY['opportunity_rental_001'],
    CARD_REGISTRY['opportunity_rental_001'],
    CARD_REGISTRY['opportunity_business_001'],
    CARD_REGISTRY['opportunity_stock_001'],
    CARD_REGISTRY['opportunity_stock_001'],
  );

  // Add IPA cards
  pool.push(
    CARD_REGISTRY['ipa_digital_001'],
    CARD_REGISTRY['ipa_digital_001'],
    CARD_REGISTRY['ipa_franchise_001'],
  );

  // Add FUBAR (engine-injected, but needs to be in pool)
  pool.push(
    CARD_REGISTRY['fubar_audit_001'],
    CARD_REGISTRY['fubar_vacancy_001'],
  );

  // Mode-specific additions
  if (mode === 'GO_ALONE') {
    pool.push(CARD_REGISTRY['opportunity_business_001']);
    pool.push(CARD_REGISTRY['ipa_multifamily_001']);
  }

  // Shuffle deterministically
  rng.shuffle(pool);

  // Convert to CardInHand instances
  return pool.map((def, idx) => toCardInHand(def, 0, rng));
}

/**
 * Converts a CardDefinition into a CardInHand runtime instance.
 */
export function toCardInHand(
  def:     CardDefinition,
  drawnAt: number,
  rng:     SeededRandom,
): CardInHand {
  // Generate deterministic instance ID from card ID + a random suffix
  const suffix = Math.floor(rng.next() * 0xFFFFFF).toString(16).padStart(6, '0');
  const instanceId = `${def.cardId}_${suffix}`;
  return {
    instanceId,
    cardId:      def.cardId,
    definition:  def,
    drawnAtTick: drawnAt,
    heldSince:   null,
    forcedEntry: false,
    forcedSource:null,
    decisionWindowRemainingMs: null,
  };
}

// ─── DRAW ENGINE ─────────────────────────────────────────────
/**
 * Stateless draw operations. All state is passed in and returned.
 * Deterministic when rng is provided.
 */
export class DrawEngine {

  /**
   * Draw N cards from the draw pile.
   * If draw pile is exhausted, reshuffles discard.
   */
  draw(
    drawPile:    CardInHand[],
    discardPile: CardInHand[],
    hand:        CardInHand[],
    count:       number,
    rng:         SeededRandom,
    maxHandSize = 5,
  ): { drawPile: CardInHand[]; discardPile: CardInHand[]; hand: CardInHand[]; drawn: CardInHand[] } {
    const drawn: CardInHand[] = [];
    let dp = [...drawPile];
    let disc = [...discardPile];
    let h = [...hand];

    for (let i = 0; i < count; i++) {
      if (dp.length === 0) {
        if (disc.length === 0) break;
        // Reshuffle discard → draw pile (deterministic)
        dp = rng.shuffle([...disc]);
        disc = [];
      }
      if (h.length >= maxHandSize) break;

      const card = dp.pop()!;
      h.push(card);
      drawn.push(card);
    }

    return { drawPile: dp, discardPile: disc, hand: h, drawn };
  }

  /**
   * Play a card from hand. Moves to discard.
   */
  play(
    hand:        CardInHand[],
    discardPile: CardInHand[],
    instanceId:  string,
  ): { hand: CardInHand[]; discardPile: CardInHand[]; card: CardInHand | null } {
    const idx = hand.findIndex(c => c.instanceId === instanceId);
    if (idx === -1) return { hand, discardPile, card: null };

    const h    = [...hand];
    const [card] = h.splice(idx, 1);
    return { hand: h, discardPile: [...discardPile, card], card };
  }

  /**
   * Inject a forced card into hand (FUBAR, hater bot, tension engine).
   */
  injectForced(
    hand:        CardInHand[],
    def:         CardDefinition,
    tick:        number,
    source:      string,
    rng:         SeededRandom,
  ): { hand: CardInHand[]; injected: CardInHand } {
    const card: CardInHand = {
      ...toCardInHand(def, tick, rng),
      forcedEntry:  true,
      forcedSource: source,
    };
    return { hand: [...hand, card], injected: card };
  }

  /**
   * Detect synergy groups in hand (cards sharing tags).
   */
  detectSynergies(hand: CardInHand[]): Map<string, string[]> {
    const tagGroups = new Map<string, string[]>();
    for (const card of hand) {
      for (const tag of card.definition.tags) {
        const group = tagGroups.get(tag) ?? [];
        group.push(card.instanceId);
        tagGroups.set(tag, group);
      }
    }
    // Only return groups with ≥ 2 cards (actual synergy)
    for (const [tag, ids] of tagGroups) {
      if (ids.length < 2) tagGroups.delete(tag);
    }
    return tagGroups;
  }

  /**
   * Compute draw pile audit hash for replay verification.
   */
  computePileHash(drawPile: CardInHand[]): string {
    const payload = drawPile.map(c => c.instanceId).join('|');
    return createHash('sha256').update(payload).digest('hex').slice(0, 16);
  }
}