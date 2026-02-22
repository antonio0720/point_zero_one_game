// ============================================================
// POINT ZERO ONE DIGITAL — Deterministic Market Engine
// Seeded PRNG + tick-accurate price simulation
// ============================================================

import { MarketTick, AssetPrice, TickId } from './types';

// ─── SEEDED PRNG (Mulberry32) ────────────────────────────────
// Same seed = same market every time. Fully deterministic.
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Gaussian via Box-Muller
  nextGaussian(mean = 0, stdDev = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

// ─── ASSET CONFIG ────────────────────────────────────────────
export interface AssetConfig {
  symbol: string;
  basePrice: number;
  dailyVolatility: number;   // e.g. 0.02 = 2% daily vol
  trend: number;             // e.g. 0.001 = slight uptrend per tick
  correlations: Record<string, number>;
}

const DEFAULT_ASSETS: AssetConfig[] = [
  { symbol: 'ALPHA', basePrice: 100,   dailyVolatility: 0.025, trend: 0.0001,  correlations: { BETA: 0.6 } },
  { symbol: 'BETA',  basePrice: 250,   dailyVolatility: 0.018, trend: 0.00005, correlations: { ALPHA: 0.6 } },
  { symbol: 'GAMMA', basePrice: 50,    dailyVolatility: 0.045, trend: -0.0002, correlations: {} },
  { symbol: 'DELTA', basePrice: 1000,  dailyVolatility: 0.012, trend: 0.0003,  correlations: {} },
  { symbol: 'OMEGA', basePrice: 0.01,  dailyVolatility: 0.08,  trend: 0.001,   correlations: { GAMMA: -0.3 } },
];

// ─── MARKET ENGINE ───────────────────────────────────────────
export class MarketEngine {
  private rng: SeededRandom;
  private prices: Map<string, number>;
  private configs: Map<string, AssetConfig>;
  private globalVolatility: number = 1.0;

  constructor(seed: number, assets: AssetConfig[] = DEFAULT_ASSETS) {
    this.rng = new SeededRandom(seed);
    this.prices = new Map();
    this.configs = new Map();

    for (const asset of assets) {
      this.configs.set(asset.symbol, asset);
      this.prices.set(asset.symbol, asset.basePrice);
    }
  }

  tick(tickId: TickId, externalShocks: Map<string, number> = new Map()): MarketTick {
    const assets = new Map<string, AssetPrice>();

    for (const [symbol, config] of this.configs) {
      const prevPrice = this.prices.get(symbol)!;
      const shock = externalShocks.get(symbol) ?? 0;

      // GBM: dS = S * (mu * dt + sigma * dW)
      const dt = 1 / (60 * 12); // 1 tick out of 720 in a 12-min run
      const dW = this.rng.nextGaussian(0, 1) * Math.sqrt(dt);
      const drift = (config.trend - 0.5 * config.dailyVolatility ** 2) * dt;
      const diffusion = config.dailyVolatility * this.globalVolatility * dW;

      const newPrice = prevPrice * Math.exp(drift + diffusion + shock);
      const clampedPrice = Math.max(newPrice, 0.0001);
      const priceChange = (clampedPrice - prevPrice) / prevPrice;

      // Synthetic spread based on volatility
      const spread = clampedPrice * config.dailyVolatility * 0.1;
      const volume = this.rng.nextRange(1000, 100000) * (1 + Math.abs(priceChange) * 10);

      assets.set(symbol, {
        symbol,
        price: clampedPrice,
        priceChange,
        volume,
        bid: clampedPrice - spread / 2,
        ask: clampedPrice + spread / 2,
        spread,
      });

      this.prices.set(symbol, clampedPrice);
    }

    // Spike volatility occasionally
    if (this.rng.next() < 0.02) {
      this.globalVolatility = 1.5 + this.rng.next() * 2;
    } else {
      this.globalVolatility = Math.max(1.0, this.globalVolatility * 0.95);
    }

    return {
      tickId,
      timestamp: Date.now(),
      assets,
      volatilityIndex: this.globalVolatility,
      liquidityPool: this.rng.nextRange(500000, 5000000),
      activeEvents: [],
    };
  }

  setShock(symbol: string, magnitude: number): void {
    const current = this.prices.get(symbol) ?? 0;
    this.prices.set(symbol, current * (1 + magnitude));
  }

  getPrice(symbol: string): number {
    return this.prices.get(symbol) ?? 0;
  }

  applyVolatilitySpike(multiplier: number): void {
    this.globalVolatility = multiplier;
  }
}
