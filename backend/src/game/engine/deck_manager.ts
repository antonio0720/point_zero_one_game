/**
 * Deck Manager class for managing game decks.
 */
export class DeckManager {
  private _drawPools: Record<string, DrawPool>;

  /**
   * Initializes the draw pools with their respective cards and weights.
   * @param cardWeights - An object mapping card types to an array of weights for each type.
   */
  constructor(private readonly cardWeights: Record<string, number[]>) {
    this._drawPools = {
      FUBAR: new DrawPool('Fubar', cardWeights['FUBAR']),
      OPPORTUNITY: new DrawPool('Opportunity', cardWeights['OPPORTUNITY']),
      MISSED_OPPORTUNITY: new DrawPool('Missed Opportunity', cardWeights['MISSED_OPPORTUNITY']),
      PRIVILEGED: new DrawPool('Privileged', cardWeights['PRIVILEGED']),
      SO: new DrawPool('SO', cardWeights['SO'])
    };
  }

  /**
   * Seeds the draw pools and shuffles them.
   * @param seed - The seed value for the random number generator.
   */
  public seed(seed: number): void {
    Object.values(this._drawPools).forEach((pool) => pool.shuffle(seed));
  }

  /**
   * Draws a card from the specified draw pool.
   * @param poolName - The name of the draw pool to draw from.
   * @returns The drawn card or null if the pool is empty.
   */
  public drawCard(poolName: string): Card | null {
    const pool = this._drawPools[poolName];
    return pool.draw();
  }
}

/**
 * Represents a draw pool with a set of cards and their respective weights.
 */
class DrawPool {
  private _cards: Card[];
  private _weights: number[];
  private _shuffledCards: Card[] = [];
  private _index: number;

  constructor(name: string, cardWeights: number[]) {
    this._cards = cardWeights.map((weight, index) => new Card(index, weight));
    this._weights = cardWeights;
    this._index = this._cards.length - 1;
  }

  /**
   * Shuffles the draw pool using the given seed value.
   * @param seed - The seed value for the random number generator.
   */
  public shuffle(seed: number): void {
    const rng = new Math.seedrandom(seed);
    this._shuffledCards = this._cards.sort((a, b) => rng() * (b.weight - a.weight));
    this._index = this._shuffledCards.length - 1;
  }

  /**
   * Draws a card from the draw pool.
   * @returns The drawn card or null if the pool is empty.
   */
  public draw(): Card | null {
    if (this._index === -1) return null;

    const card = this._shuffledCards[this._index--];
    return card;
  }
}

/**
 * Represents a single card in the game with an index and weight.
 */
class Card {
  constructor(public readonly index: number, public readonly weight: number) {}
}
