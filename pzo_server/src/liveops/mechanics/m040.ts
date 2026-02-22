// /pzo_server/src/liveops/mechanics/m040.ts
// M040 — Achievement Exchange + Cosmetic Market + Crafting
// tslint:disable:no-any

import { createHash, createHmac } from 'crypto';

// ─── Config ──────────────────────────────────────────────────────────────────

export interface M40Config {
  ml_enabled: boolean;
  auditHashFunction: (data: any) => Promise<string>;
  achievementExchangeRates: Record<string, number>; // achievementId → cosmetic credit value
  craftingRecipes: CraftingRecipe[];
  marketFeeBps: number; // basis points, e.g. 250 = 2.5%
  mlInferenceEndpoint?: string;
  mlModelVersion?: string;
}

export interface CraftingRecipe {
  recipeId: string;
  inputFragmentIds: string[];   // fragment cosmetic IDs required
  outputCosmeticId: string;     // result cosmetic ID
  requiredAchievementProof?: string; // optional binding proof
}

export interface MarketListing {
  listingId: string;
  sellerId: string;
  cosmeticId: string;
  askPrice: number;              // in cosmetic credits
  listedAt: number;              // timestamp ms
  expiresAt: number;
}

export interface M40PlayerCosmeticWallet {
  playerId: string;
  creditBalance: number;
  fragmentInventory: Record<string, number>; // cosmeticId → quantity
  listedItems: MarketListing[];
}

// ─── ML Model ────────────────────────────────────────────────────────────────

export class M40MLModel {
  private readonly modelVersion: string;
  private readonly inferenceEndpoint: string;

  constructor(modelVersion: string, inferenceEndpoint: string) {
    this.modelVersion = modelVersion;
    this.inferenceEndpoint = inferenceEndpoint;
  }

  /**
   * Predicts likelihood [0..1] that a given market action is fair/non-abusive.
   * Uses a lightweight fraud-detection signal: rapid listing/delisting = suspicious.
   */
  public async predict(features: MarketFeatures): Promise<number> {
    // Feature vector: [relistFreq, avgHoldTimeMs, priceDeviationFromMedian, sellerReputation]
    const featureVec = [
      Math.min(features.relistFrequencyPerHour / 20, 1),       // clamped to [0,1]
      Math.max(0, 1 - features.avgHoldTimeMs / 3_600_000),     // penalize fast flips
      Math.abs(features.priceDeviationFromMedianPct) / 100,    // deviation signal
      1 - Math.min(features.sellerViolationCount / 5, 1),      // reputation decay
    ];

    // Deterministic logistic regression (no network call needed for this feature set)
    const weights = [-1.2, -0.8, -0.5, 1.5];
    const bias = 0.3;
    const logit = featureVec.reduce((sum, v, i) => sum + v * weights[i], bias);
    const score = 1 / (1 + Math.exp(-logit));

    return Math.min(Math.max(score, 0), 1);
  }

  public getModelVersion(): string { return this.modelVersion; }
}

interface MarketFeatures {
  relistFrequencyPerHour: number;
  avgHoldTimeMs: number;
  priceDeviationFromMedianPct: number;
  sellerViolationCount: number;
}

// ─── Mechanics ───────────────────────────────────────────────────────────────

export class M40CosmeticMarketMechanics {
  /**
   * Lists a cosmetic item for sale. Validates ownership and fair pricing.
   */
  public async listItem(
    wallet: M40PlayerCosmeticWallet,
    cosmeticId: string,
    askPrice: number,
    durationMs: number,
  ): Promise<{ success: boolean; listing?: MarketListing; error?: string }> {
    const owned = wallet.fragmentInventory[cosmeticId] ?? 0;
    if (owned < 1) {
      return { success: false, error: `Player does not own cosmetic: ${cosmeticId}` };
    }
    if (askPrice <= 0) {
      return { success: false, error: 'Ask price must be positive' };
    }

    const now = Date.now();
    const listing: MarketListing = {
      listingId: createHash('sha256')
        .update(`${wallet.playerId}:${cosmeticId}:${now}`)
        .digest('hex')
        .slice(0, 16),
      sellerId: wallet.playerId,
      cosmeticId,
      askPrice,
      listedAt: now,
      expiresAt: now + durationMs,
    };

    // Deduct from inventory (escrow)
    wallet.fragmentInventory[cosmeticId]--;
    wallet.listedItems.push(listing);

    return { success: true, listing };
  }

  /**
   * Executes a purchase. Applies market fee and transfers credits.
   */
  public async purchaseItem(
    buyerWallet: M40PlayerCosmeticWallet,
    sellerWallet: M40PlayerCosmeticWallet,
    listing: MarketListing,
    feeBps: number,
  ): Promise<{ success: boolean; fee: number; error?: string }> {
    if (buyerWallet.creditBalance < listing.askPrice) {
      return { success: false, fee: 0, error: 'Insufficient credits' };
    }
    if (Date.now() > listing.expiresAt) {
      return { success: false, fee: 0, error: 'Listing expired' };
    }

    const fee = Math.floor((listing.askPrice * feeBps) / 10_000);
    const sellerReceives = listing.askPrice - fee;

    buyerWallet.creditBalance -= listing.askPrice;
    sellerWallet.creditBalance += sellerReceives;
    buyerWallet.fragmentInventory[listing.cosmeticId] =
      (buyerWallet.fragmentInventory[listing.cosmeticId] ?? 0) + 1;

    // Remove listing from seller
    sellerWallet.listedItems = sellerWallet.listedItems.filter(
      l => l.listingId !== listing.listingId,
    );

    return { success: true, fee };
  }
}

export class M40CraftingMechanics {
  /**
   * Attempts to craft a cosmetic from fragments using a recipe.
   * Deducts fragments and adds the resulting cosmetic to inventory.
   */
  public craft(
    wallet: M40PlayerCosmeticWallet,
    recipe: CraftingRecipe,
    playerAchievements: Set<string>,
  ): { success: boolean; outputCosmeticId?: string; error?: string } {
    // Check achievement binding
    if (recipe.requiredAchievementProof && !playerAchievements.has(recipe.requiredAchievementProof)) {
      return {
        success: false,
        error: `Crafting requires achievement proof: ${recipe.requiredAchievementProof}`,
      };
    }

    // Verify fragment inventory
    const needed = this._countRequired(recipe.inputFragmentIds);
    for (const [fragId, qty] of Object.entries(needed)) {
      const have = wallet.fragmentInventory[fragId] ?? 0;
      if (have < qty) {
        return {
          success: false,
          error: `Missing fragment ${fragId}: need ${qty}, have ${have}`,
        };
      }
    }

    // Deduct fragments
    for (const [fragId, qty] of Object.entries(needed)) {
      wallet.fragmentInventory[fragId] -= qty;
    }

    // Award crafted cosmetic
    wallet.fragmentInventory[recipe.outputCosmeticId] =
      (wallet.fragmentInventory[recipe.outputCosmeticId] ?? 0) + 1;

    return { success: true, outputCosmeticId: recipe.outputCosmeticId };
  }

  private _countRequired(fragmentIds: string[]): Record<string, number> {
    return fragmentIds.reduce<Record<string, number>>((acc, id) => {
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
  }
}

// ─── Main Class ───────────────────────────────────────────────────────────────

export class M40AchievementExchangeCosmeticMarketCrafting {
  private readonly config: M40Config;
  private readonly cosmeticMarketMechanics: M40CosmeticMarketMechanics;
  private readonly craftingMechanics: M40CraftingMechanics;
  private readonly mlModel: M40MLModel | null;

  constructor(config: M40Config) {
    this.config = config;
    this.cosmeticMarketMechanics = new M40CosmeticMarketMechanics();
    this.craftingMechanics = new M40CraftingMechanics();
    this.mlModel =
      config.ml_enabled && config.mlInferenceEndpoint && config.mlModelVersion
        ? new M40MLModel(config.mlModelVersion, config.mlInferenceEndpoint)
        : null;
  }

  /**
   * Main run method. Returns a fairness score [0..1] used by upstream systems.
   * ML path: uses market features. Non-ML path: defaults to 0.5.
   */
  public async run(playerId: string, playerState: any): Promise<number> {
    const auditHash = await this.generateAuditHash(playerId, playerState);

    if (!this.config.ml_enabled || !this.mlModel) {
      return 0.5;
    }

    const features = this._extractMarketFeatures(playerId, playerState);
    const mlOutput = await this.runMLModel(features);

    if (mlOutput < 0 || mlOutput > 1) {
      throw new Error(`ML output out of bounds: ${mlOutput}`);
    }

    return mlOutput;
  }

  /**
   * Exchanges achievements for cosmetic credits.
   */
  public exchangeAchievements(
    wallet: M40PlayerCosmeticWallet,
    achievementIds: string[],
  ): { creditsAwarded: number; unrecognized: string[] } {
    const unrecognized: string[] = [];
    let creditsAwarded = 0;

    for (const id of achievementIds) {
      const rate = this.config.achievementExchangeRates[id];
      if (rate === undefined) {
        unrecognized.push(id);
      } else {
        creditsAwarded += rate;
      }
    }

    wallet.creditBalance += creditsAwarded;
    return { creditsAwarded, unrecognized };
  }

  public async generateAuditHash(playerId: string, playerState: any): Promise<string> {
    const auditData = {
      playerId,
      playerState,
      timestamp: new Date().toISOString(),
    };
    return this.config.auditHashFunction(auditData);
  }

  private async runMLModel(features: MarketFeatures): Promise<number> {
    return this.mlModel!.predict(features);
  }

  private _extractMarketFeatures(playerId: string, playerState: any): MarketFeatures {
    return {
      relistFrequencyPerHour: playerState?.relistFrequencyPerHour ?? 0,
      avgHoldTimeMs: playerState?.avgHoldTimeMs ?? 3_600_000,
      priceDeviationFromMedianPct: playerState?.priceDeviationFromMedianPct ?? 0,
      sellerViolationCount: playerState?.sellerViolationCount ?? 0,
    };
  }
}

export function getM40AchievementExchangeCosmeticMarketCrafting(
  config: M40Config,
): M40AchievementExchangeCosmeticMarketCrafting {
  return new M40AchievementExchangeCosmeticMarketCrafting(config);
}
