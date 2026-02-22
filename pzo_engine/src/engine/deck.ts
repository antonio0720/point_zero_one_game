// ============================================================
// POINT ZERO ONE DIGITAL — Deck & Card System
// Draw engine, hand management, combo detection
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { Card, CardType, CardEffect, Deck } from './types';
import { SeededRandom } from './market-engine';

// ─── STARTER CARDS ───────────────────────────────────────────
export const CARD_REGISTRY: Record<string, Card> = {
  BULL_CALL: {
    id: 'BULL_CALL',
    name: 'Bull Call',
    type: CardType.LONG,
    rarity: 'COMMON',
    cost: 1,
    leverage: 1,
    durationTicks: 30,
    description: 'Open a standard long position. Low risk, steady returns.',
    effect: { priceImpact: 0.002, volatilityMod: 0, liquidityDrain: 100, synergies: ['MOMENTUM_RIDER'] },
  },
  BEAR_RAID: {
    id: 'BEAR_RAID',
    name: 'Bear Raid',
    type: CardType.SHORT,
    rarity: 'COMMON',
    cost: 1,
    leverage: 1,
    durationTicks: 30,
    description: 'Short the market. Profits when price falls.',
    effect: { priceImpact: -0.003, volatilityMod: 0.1, liquidityDrain: 150, synergies: ['PANIC_SELL'] },
  },
  LEVERAGED_LONG: {
    id: 'LEVERAGED_LONG',
    name: 'Leveraged Long',
    type: CardType.LONG,
    rarity: 'RARE',
    cost: 2,
    leverage: 3,
    durationTicks: 20,
    description: '3x long. High risk. Can liquidate if price drops 30%.',
    effect: { priceImpact: 0.008, volatilityMod: 0.2, liquidityDrain: 500, synergies: ['MOMENTUM_RIDER', 'CIRCUIT_BREAKER'] },
  },
  DELTA_HEDGE: {
    id: 'DELTA_HEDGE',
    name: 'Delta Hedge',
    type: CardType.HEDGE,
    rarity: 'RARE',
    cost: 2,
    leverage: 1,
    durationTicks: 60,
    description: 'Neutralize directional risk. Profits from volatility.',
    effect: { priceImpact: 0, volatilityMod: -0.15, liquidityDrain: 200, synergies: ['GAMMA_SQUEEZE', 'STRADDLE'] },
  },
  BLACK_SWAN: {
    id: 'BLACK_SWAN',
    name: 'Black Swan',
    type: CardType.EVENT,
    rarity: 'LEGENDARY',
    cost: 0,
    leverage: 1,
    durationTicks: 5,
    description: 'Triggered randomly. Causes 15-40% market crash.',
    effect: { priceImpact: -0.25, volatilityMod: 3.0, liquidityDrain: 5000, synergies: [] },
  },
  MOMENTUM_RIDER: {
    id: 'MOMENTUM_RIDER',
    name: 'Momentum Rider',
    type: CardType.LONG,
    rarity: 'RARE',
    cost: 2,
    leverage: 2,
    durationTicks: 15,
    description: 'Amplifies trend direction. Synergizes with Bull Call.',
    effect: { priceImpact: 0.005, volatilityMod: 0.1, liquidityDrain: 300, synergies: ['BULL_CALL'] },
  },
  GAMMA_SQUEEZE: {
    id: 'GAMMA_SQUEEZE',
    name: 'Gamma Squeeze',
    type: CardType.MACRO,
    rarity: 'LEGENDARY',
    cost: 3,
    leverage: 5,
    durationTicks: 10,
    description: 'Forces a short squeeze. Explosive upward pressure.',
    effect: { priceImpact: 0.12, volatilityMod: 1.5, liquidityDrain: 2000, synergies: ['DELTA_HEDGE', 'BULL_CALL'] },
  },
  CIRCUIT_BREAKER: {
    id: 'CIRCUIT_BREAKER',
    name: 'Circuit Breaker',
    type: CardType.HEDGE,
    rarity: 'COMMON',
    cost: 1,
    leverage: 1,
    durationTicks: 1,
    description: 'Emergency stop. Close all positions immediately.',
    effect: { priceImpact: 0, volatilityMod: -0.5, liquidityDrain: 0, synergies: [] },
  },
};

// ─── STARTER DECK ────────────────────────────────────────────
export function buildStarterDeck(rng: SeededRandom): Deck {
  const cards: Card[] = [
    ...Array(4).fill(null).map(() => ({ ...CARD_REGISTRY['BULL_CALL'], id: uuidv4() })),
    ...Array(4).fill(null).map(() => ({ ...CARD_REGISTRY['BEAR_RAID'], id: uuidv4() })),
    ...Array(3).fill(null).map(() => ({ ...CARD_REGISTRY['DELTA_HEDGE'], id: uuidv4() })),
    ...Array(2).fill(null).map(() => ({ ...CARD_REGISTRY['LEVERAGED_LONG'], id: uuidv4() })),
    ...Array(2).fill(null).map(() => ({ ...CARD_REGISTRY['MOMENTUM_RIDER'], id: uuidv4() })),
    ...Array(1).fill(null).map(() => ({ ...CARD_REGISTRY['CIRCUIT_BREAKER'], id: uuidv4() })),
    ...Array(1).fill(null).map(() => ({ ...CARD_REGISTRY['GAMMA_SQUEEZE'], id: uuidv4() })),
  ];

  // Seeded shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return {
    id: uuidv4(),
    name: 'Starter Deck',
    cards: [...cards],
    drawPile: [...cards],
    hand: [],
    discardPile: [],
    maxHandSize: 5,
  };
}

// ─── DRAW ENGINE ─────────────────────────────────────────────
export class DrawEngine {
  draw(deck: Deck, count: number = 1): { deck: Deck; drawn: Card[] } {
    const drawn: Card[] = [];
    let drawPile = [...deck.drawPile];
    let discardPile = [...deck.discardPile];
    let hand = [...deck.hand];

    for (let i = 0; i < count; i++) {
      if (drawPile.length === 0) {
        // Reshuffle discard into draw pile
        if (discardPile.length === 0) break;
        drawPile = [...discardPile];
        discardPile = [];
        // Simple shuffle (non-deterministic here, use seeded in game loop)
        drawPile.sort(() => Math.random() - 0.5);
      }

      if (hand.length >= deck.maxHandSize) break;

      const card = drawPile.pop()!;
      hand.push(card);
      drawn.push(card);
    }

    return {
      deck: { ...deck, drawPile, discardPile, hand },
      drawn,
    };
  }

  play(deck: Deck, cardId: string): { deck: Deck; card: Card | null } {
    const idx = deck.hand.findIndex(c => c.id === cardId);
    if (idx === -1) return { deck, card: null };

    const hand = [...deck.hand];
    const [card] = hand.splice(idx, 1);
    const discardPile = [...deck.discardPile, card];

    return { deck: { ...deck, hand, discardPile }, card };
  }

  detectCombos(hand: Card[]): string[][] {
    const combos: string[][] = [];
    for (const card of hand) {
      const synergies = card.effect.synergies;
      const inHand = synergies.filter(s => hand.some(c => c.name === s || CARD_REGISTRY[s]?.name === s));
      if (inHand.length > 0) {
        combos.push([card.name, ...inHand]);
      }
    }
    return combos;
  }
}
