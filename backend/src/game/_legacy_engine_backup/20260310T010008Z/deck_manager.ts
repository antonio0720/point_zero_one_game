/**
 * POINT ZERO ONE — BACKEND DECK MANAGER
 * backend/src/game/engine/deck_manager.ts
 *
 * Deterministic weighted draw pool manager.
 *
 * Fixes:
 * - removes invalid Math.seedrandom usage
 * - uses local seeded RNG
 * - preserves weighted draw behavior without external dependencies
 */

export type DrawPoolName =
  | 'FUBAR'
  | 'OPPORTUNITY'
  | 'MISSED_OPPORTUNITY'
  | 'PRIVILEGED'
  | 'SO';

export interface Card {
  readonly index: number;
  readonly weight: number;
}

type CardWeightsByPool = Partial<Record<DrawPoolName, readonly number[]>>;

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    return 0x9e3779b9;
  }

  const normalized = Math.abs(Math.trunc(seed)) >>> 0;
  return normalized === 0 ? 0x9e3779b9 : normalized;
}

function createMulberry32(seed: number): () => number {
  let state = normalizeSeed(seed);

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sanitizeWeights(weights: readonly number[] | undefined): number[] {
  if (!weights || weights.length === 0) {
    return [];
  }

  return weights.map((weight) => {
    if (!Number.isFinite(weight) || weight <= 0) {
      return 1;
    }

    return weight;
  });
}

class DrawPool {
  private readonly cards: Card[];
  private readonly weights: number[];
  private orderedCards: Card[];
  private cursor: number;

  public constructor(cardWeights: readonly number[]) {
    this.weights = sanitizeWeights(cardWeights);
    this.cards = this.weights.map((weight, index) => ({
      index,
      weight,
    }));
    this.orderedCards = [...this.cards];
    this.cursor = 0;
  }

  public shuffle(seed: number): void {
    const rng = createMulberry32(seed);
    const remainingCards = [...this.cards];
    const remainingWeights = [...this.weights];
    const ordered: Card[] = [];

    while (remainingCards.length > 0) {
      const totalWeight = remainingWeights.reduce((sum, weight) => sum + weight, 0);

      let threshold = rng() * totalWeight;
      let selectedIndex = 0;

      for (let i = 0; i < remainingWeights.length; i += 1) {
        threshold -= remainingWeights[i];
        if (threshold <= 0) {
          selectedIndex = i;
          break;
        }
      }

      ordered.push(remainingCards[selectedIndex]);
      remainingCards.splice(selectedIndex, 1);
      remainingWeights.splice(selectedIndex, 1);
    }

    this.orderedCards = ordered;
    this.cursor = 0;
  }

  public draw(): Card | null {
    if (this.cursor >= this.orderedCards.length) {
      return null;
    }

    const card = this.orderedCards[this.cursor];
    this.cursor += 1;
    return card;
  }

  public remaining(): number {
    return this.orderedCards.length - this.cursor;
  }

  public reset(): void {
    this.orderedCards = [...this.cards];
    this.cursor = 0;
  }
}

export class DeckManager {
  private readonly drawPools: Record<DrawPoolName, DrawPool>;

  public constructor(cardWeights: CardWeightsByPool) {
    this.drawPools = {
      FUBAR: new DrawPool(cardWeights.FUBAR ?? []),
      OPPORTUNITY: new DrawPool(cardWeights.OPPORTUNITY ?? []),
      MISSED_OPPORTUNITY: new DrawPool(cardWeights.MISSED_OPPORTUNITY ?? []),
      PRIVILEGED: new DrawPool(cardWeights.PRIVILEGED ?? []),
      SO: new DrawPool(cardWeights.SO ?? []),
    };
  }

  public seed(seed: number): void {
    const baseSeed = normalizeSeed(seed);

    (Object.keys(this.drawPools) as DrawPoolName[]).forEach((poolName, index) => {
      this.drawPools[poolName].shuffle(baseSeed + index * 9973);
    });
  }

  public drawCard(poolName: DrawPoolName): Card | null {
    return this.drawPools[poolName].draw();
  }

  public remaining(poolName: DrawPoolName): number {
    return this.drawPools[poolName].remaining();
  }

  public reset(): void {
    (Object.keys(this.drawPools) as DrawPoolName[]).forEach((poolName) => {
      this.drawPools[poolName].reset();
    });
  }
}