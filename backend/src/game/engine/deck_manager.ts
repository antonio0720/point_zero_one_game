/**
 * POINT ZERO ONE — BACKEND DECK MANAGER
 * backend/src/game/engine/deck_manager.ts
 *
 * Deterministic weighted draw pool manager.
 *
 * Upgrades:
 * - canonical RNG utilities shared across engine
 * - deterministic per-pool seed derivation
 * - snapshot / restore for replay and test harnesses
 * - optional auto-reshuffle without hidden nondeterminism
 * - draw receipts without breaking existing Card consumers
 */

import {
  combineSeed,
  createDeterministicRng,
  normalizeSeed,
  sanitizePositiveWeights,
} from './deterministic_rng';

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

export interface DrawReceipt {
  readonly poolName: DrawPoolName;
  readonly card: Card;
  readonly cardInstanceId: string;
  readonly cycle: number;
  readonly drawOrdinal: number;
  readonly poolSeed: number;
  readonly remainingAfterDraw: number;
}

export interface DrawPoolSnapshot {
  readonly poolName: DrawPoolName;
  readonly weights: readonly number[];
  readonly orderedCardIndexes: readonly number[];
  readonly cursor: number;
  readonly cycle: number;
  readonly totalDraws: number;
  readonly lastSeed: number;
}

export interface DeckManagerSnapshot {
  readonly baseSeed: number;
  readonly pools: Record<DrawPoolName, DrawPoolSnapshot>;
}

export interface DeckManagerOptions {
  readonly autoReshuffleOnExhaustion?: boolean;
}

type CardWeightsByPool = Partial<Record<DrawPoolName, readonly number[]>>;

const POOL_ORDER: readonly DrawPoolName[] = [
  'FUBAR',
  'OPPORTUNITY',
  'MISSED_OPPORTUNITY',
  'PRIVILEGED',
  'SO',
];

function buildCardInstanceId(
  poolName: DrawPoolName,
  cycle: number,
  drawOrdinal: number,
  cardIndex: number,
  poolSeed: number,
): string {
  return [
    poolName,
    String(cycle),
    String(drawOrdinal),
    String(cardIndex),
    String(poolSeed),
  ].join(':');
}

function buildDefaultOrder(length: number): number[] {
  return Array.from({ length }, (_, index) => index);
}

class DrawPool {
  private readonly poolName: DrawPoolName;
  private readonly cards: readonly Card[];
  private readonly weights: readonly number[];
  private readonly autoReshuffleOnExhaustion: boolean;

  private orderedCardIndexes: number[];
  private cursor: number;
  private cycle: number;
  private totalDraws: number;
  private lastSeed: number;

  public constructor(
    poolName: DrawPoolName,
    cardWeights: readonly number[],
    options: DeckManagerOptions,
  ) {
    this.poolName = poolName;
    this.weights = sanitizePositiveWeights(cardWeights);
    this.cards = this.weights.map((weight, index) => ({
      index,
      weight,
    }));
    this.autoReshuffleOnExhaustion = options.autoReshuffleOnExhaustion ?? false;

    this.orderedCardIndexes = buildDefaultOrder(this.cards.length);
    this.cursor = 0;
    this.cycle = 0;
    this.totalDraws = 0;
    this.lastSeed = 0;
  }

  public seed(seed: number): void {
    this.shuffle(normalizeSeed(seed));
  }

  public shuffle(seed: number): void {
    const normalizedSeed = normalizeSeed(seed);

    if (this.cards.length === 0) {
      this.lastSeed = normalizedSeed;
      this.cursor = 0;
      this.orderedCardIndexes = [];
      return;
    }

    const rng = createDeterministicRng(normalizedSeed);
    const remainingIndexes = buildDefaultOrder(this.cards.length);
    const ordered: number[] = [];

    while (remainingIndexes.length > 0) {
      const selectedOffset = rng.pickIndexByWeights(
        remainingIndexes.map((cardIndex) => this.weights[cardIndex]),
      );

      ordered.push(remainingIndexes[selectedOffset]);
      remainingIndexes.splice(selectedOffset, 1);
    }

    this.orderedCardIndexes = ordered;
    this.cursor = 0;
    this.lastSeed = normalizedSeed;
  }

  public draw(): Card | null {
    return this.drawDetailed()?.card ?? null;
  }

  public drawDetailed(): DrawReceipt | null {
    if (this.cards.length === 0) {
      return null;
    }

    if (this.cursor >= this.orderedCardIndexes.length) {
      if (!this.autoReshuffleOnExhaustion) {
        return null;
      }

      this.cycle += 1;
      this.shuffle(
        combineSeed(
          this.lastSeed === 0 ? this.cards.length : this.lastSeed,
          `${this.poolName}:cycle:${this.cycle}`,
        ),
      );
    }

    if (this.cursor >= this.orderedCardIndexes.length) {
      return null;
    }

    const orderedCardIndex = this.orderedCardIndexes[this.cursor];
    const card = this.cards[orderedCardIndex];
    const drawOrdinal = this.totalDraws;

    this.cursor += 1;
    this.totalDraws += 1;

    return {
      poolName: this.poolName,
      card,
      cardInstanceId: buildCardInstanceId(
        this.poolName,
        this.cycle,
        drawOrdinal,
        card.index,
        this.lastSeed,
      ),
      cycle: this.cycle,
      drawOrdinal,
      poolSeed: this.lastSeed,
      remainingAfterDraw: this.remaining(),
    };
  }

  public peek(): Card | null {
    return this.peekDetailed()?.card ?? null;
  }

  public peekDetailed(): DrawReceipt | null {
    if (this.cards.length === 0 || this.cursor >= this.orderedCardIndexes.length) {
      return null;
    }

    const orderedCardIndex = this.orderedCardIndexes[this.cursor];
    const card = this.cards[orderedCardIndex];

    return {
      poolName: this.poolName,
      card,
      cardInstanceId: buildCardInstanceId(
        this.poolName,
        this.cycle,
        this.totalDraws,
        card.index,
        this.lastSeed,
      ),
      cycle: this.cycle,
      drawOrdinal: this.totalDraws,
      poolSeed: this.lastSeed,
      remainingAfterDraw: this.remaining(),
    };
  }

  public remaining(): number {
    return Math.max(0, this.orderedCardIndexes.length - this.cursor);
  }

  public reset(): void {
    this.orderedCardIndexes = buildDefaultOrder(this.cards.length);
    this.cursor = 0;
    this.cycle = 0;
    this.totalDraws = 0;
    this.lastSeed = 0;
  }

  public snapshot(): DrawPoolSnapshot {
    return {
      poolName: this.poolName,
      weights: [...this.weights],
      orderedCardIndexes: [...this.orderedCardIndexes],
      cursor: this.cursor,
      cycle: this.cycle,
      totalDraws: this.totalDraws,
      lastSeed: this.lastSeed,
    };
  }

  public restore(snapshot: DrawPoolSnapshot): void {
    if (snapshot.poolName !== this.poolName) {
      throw new Error(
        `Cannot restore pool snapshot. Expected ${this.poolName}, received ${snapshot.poolName}.`,
      );
    }

    if (snapshot.weights.length !== this.weights.length) {
      throw new Error(
        `Cannot restore pool snapshot for ${this.poolName}. Weight length mismatch.`,
      );
    }

    for (let i = 0; i < this.weights.length; i += 1) {
      if (snapshot.weights[i] !== this.weights[i]) {
        throw new Error(
          `Cannot restore pool snapshot for ${this.poolName}. Weight mismatch at index ${i}.`,
        );
      }
    }

    const maxIndex = this.cards.length - 1;
    for (const index of snapshot.orderedCardIndexes) {
      if (!Number.isInteger(index) || index < 0 || index > maxIndex) {
        throw new Error(
          `Cannot restore pool snapshot for ${this.poolName}. Invalid ordered card index ${String(index)}.`,
        );
      }
    }

    if (
      !Number.isInteger(snapshot.cursor) ||
      snapshot.cursor < 0 ||
      snapshot.cursor > snapshot.orderedCardIndexes.length
    ) {
      throw new Error(
        `Cannot restore pool snapshot for ${this.poolName}. Invalid cursor ${String(snapshot.cursor)}.`,
      );
    }

    this.orderedCardIndexes = [...snapshot.orderedCardIndexes];
    this.cursor = snapshot.cursor;
    this.cycle = Math.max(0, Math.trunc(snapshot.cycle));
    this.totalDraws = Math.max(0, Math.trunc(snapshot.totalDraws));
    this.lastSeed = normalizeSeed(snapshot.lastSeed);
  }
}

export class DeckManager {
  private readonly drawPools: Record<DrawPoolName, DrawPool>;
  private baseSeed: number;

  public constructor(
    cardWeights: CardWeightsByPool,
    options: DeckManagerOptions = {},
  ) {
    this.drawPools = {
      FUBAR: new DrawPool('FUBAR', cardWeights.FUBAR ?? [], options),
      OPPORTUNITY: new DrawPool('OPPORTUNITY', cardWeights.OPPORTUNITY ?? [], options),
      MISSED_OPPORTUNITY: new DrawPool(
        'MISSED_OPPORTUNITY',
        cardWeights.MISSED_OPPORTUNITY ?? [],
        options,
      ),
      PRIVILEGED: new DrawPool('PRIVILEGED', cardWeights.PRIVILEGED ?? [], options),
      SO: new DrawPool('SO', cardWeights.SO ?? [], options),
    };

    this.baseSeed = 0;
  }

  public seed(seed: number): void {
    this.baseSeed = normalizeSeed(seed);

    for (const poolName of POOL_ORDER) {
      this.drawPools[poolName].seed(combineSeed(this.baseSeed, poolName));
    }
  }

  public drawCard(poolName: DrawPoolName): Card | null {
    return this.drawPools[poolName].draw();
  }

  public drawCardDetailed(poolName: DrawPoolName): DrawReceipt | null {
    return this.drawPools[poolName].drawDetailed();
  }

  public peekCard(poolName: DrawPoolName): Card | null {
    return this.drawPools[poolName].peek();
  }

  public peekCardDetailed(poolName: DrawPoolName): DrawReceipt | null {
    return this.drawPools[poolName].peekDetailed();
  }

  public remaining(poolName: DrawPoolName): number {
    return this.drawPools[poolName].remaining();
  }

  public poolNames(): readonly DrawPoolName[] {
    return POOL_ORDER;
  }

  public snapshot(): DeckManagerSnapshot {
    return {
      baseSeed: this.baseSeed,
      pools: {
        FUBAR: this.drawPools.FUBAR.snapshot(),
        OPPORTUNITY: this.drawPools.OPPORTUNITY.snapshot(),
        MISSED_OPPORTUNITY: this.drawPools.MISSED_OPPORTUNITY.snapshot(),
        PRIVILEGED: this.drawPools.PRIVILEGED.snapshot(),
        SO: this.drawPools.SO.snapshot(),
      },
    };
  }

  public restore(snapshot: DeckManagerSnapshot): void {
    this.baseSeed = normalizeSeed(snapshot.baseSeed);

    for (const poolName of POOL_ORDER) {
      this.drawPools[poolName].restore(snapshot.pools[poolName]);
    }
  }

  public reset(): void {
    this.baseSeed = 0;

    for (const poolName of POOL_ORDER) {
      this.drawPools[poolName].reset();
    }
  }
}