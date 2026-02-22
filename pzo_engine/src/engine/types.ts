// ============================================================
// POINT ZERO ONE DIGITAL — Core Type System
// Financial Roguelike Engine v1.0
// ============================================================

export type CardId = string;
export type RunId = string;
export type PlayerId = string;
export type TickId = number;

// ─── FINANCIAL POSITION ─────────────────────────────────────
export interface Position {
  assetId: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  isLong: boolean;
}

export interface Portfolio {
  cash: number;
  positions: Map<string, Position>;
  totalEquity: number;
  peakEquity: number;
  maxDrawdown: number;
}

// ─── CARDS ──────────────────────────────────────────────────
export enum CardType {
  LONG   = 'LONG',
  SHORT  = 'SHORT',
  HEDGE  = 'HEDGE',
  MACRO  = 'MACRO',
  EVENT  = 'EVENT',
  CRISIS = 'CRISIS',
}

export interface Card {
  id: CardId;
  name: string;
  type: CardType;
  rarity: 'COMMON' | 'RARE' | 'LEGENDARY';
  cost: number;           // energy cost to play
  leverage: number;       // multiplier
  durationTicks: number;  // how many ticks card stays active
  effect: CardEffect;
  description: string;
}

export interface CardEffect {
  priceImpact: number;      // % price change this card causes
  volatilityMod: number;    // modifies market volatility
  liquidityDrain: number;   // removes liquidity from market
  synergies: string[];      // card ids that combo with this
}

// ─── DECK ───────────────────────────────────────────────────
export interface Deck {
  id: string;
  name: string;
  cards: Card[];
  drawPile: Card[];
  hand: Card[];
  discardPile: Card[];
  maxHandSize: number;
}

// ─── MARKET ─────────────────────────────────────────────────
export interface MarketTick {
  tickId: TickId;
  timestamp: number;
  assets: Map<string, AssetPrice>;
  volatilityIndex: number;
  liquidityPool: number;
  activeEvents: string[];
}

export interface AssetPrice {
  symbol: string;
  price: number;
  priceChange: number;    // % change since last tick
  volume: number;
  bid: number;
  ask: number;
  spread: number;
}

// ─── RUN ────────────────────────────────────────────────────
export enum RunPhase {
  SETUP      = 'SETUP',
  ACTIVE     = 'ACTIVE',
  CRISIS     = 'CRISIS',
  SETTLEMENT = 'SETTLEMENT',
  COMPLETE   = 'COMPLETE',
}

export interface Run {
  id: RunId;
  playerId: PlayerId;
  phase: RunPhase;
  startTime: number;
  endTime?: number;
  durationMs: number;       // 12 minutes = 720000ms
  currentTick: TickId;
  maxTicks: number;
  portfolio: Portfolio;
  deck: Deck;
  activeCards: ActiveCard[];
  score: number;
  seed: number;             // deterministic seed
}

export interface ActiveCard {
  card: Card;
  playedAtTick: TickId;
  expiresAtTick: TickId;
  positionId?: string;
}

// ─── GAME STATE ──────────────────────────────────────────────
export interface GameState {
  run: Run;
  market: MarketTick;
  energy: number;
  maxEnergy: number;
  turn: number;
  actionLog: GameAction[];
}

export interface GameAction {
  tick: TickId;
  type: 'PLAY_CARD' | 'CLOSE_POSITION' | 'DRAW' | 'PASS' | 'SETTLEMENT';
  payload: Record<string, unknown>;
  timestamp: number;
}

// ─── ENGINE EVENTS ───────────────────────────────────────────
export interface EngineEvent {
  type: string;
  tick: TickId;
  data: Record<string, unknown>;
}

export type EngineListener = (event: EngineEvent) => void;
