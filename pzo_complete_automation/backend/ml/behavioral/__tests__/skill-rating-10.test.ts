import { describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Test Suite: Skill Rating Module (ML Behavioral)
 * Validates ELO-based skill tracking, rating updates, and matchmaking logic.
 */

// Mock types matching Python module
interface SkillRating {
  contestantId: string;
  overallRating: number;
  riskAssessment: number;
  resourceAllocation: number;
  timingOptimization: number;
  portfolioConstruction: number;
  crisisResponse: number;
  volatility: number;
  gamesPlayed: number;
  lastUpdated: Date;
  confidenceInterval: number;
}

interface SkillRatingEngine {
  initializeRating(contestantId: string): SkillRating;
  calculateKFactor(gamesPlayed: number, volatility: number): number;
  expectedScore(ratingA: number, ratingB: number): number;
  updateRating(
    current: SkillRating,
    actualScore: number,
    opponentRating: number,
    domainScores?: Record<string, number>
  ): SkillRating;
  calculateMatchmakingRange(rating: SkillRating): [number, number];
  estimateWinProbability(player: SkillRating, difficulty: number): number;
  getSkillPercentile(rating: number, allRatings: number[]): number;
  getRatingTrend(contestantId: string, games?: number): number | null;
}

// Mock implementation for testing
class MockSkillRatingEngine implements SkillRatingEngine {
  private readonly BASE_RATING = 1500.0;
  private readonly K_FACTOR_BASE = 32.0;
  private readonly K_FACTOR_MIN = 16.0;
  private readonly VOLATILITY_DECAY = 0.95;
  private ratingHistory: Map<string, SkillRating[]> = new Map();

  initializeRating(contestantId: string): SkillRating {
    return {
      contestantId,
      overallRating: this.BASE_RATING,
      riskAssessment: this.BASE_RATING,
      resourceAllocation: this.BASE_RATING,
      timingOptimization: this.BASE_RATING,
      portfolioConstruction: this.BASE_RATING,
      crisisResponse: this.BASE_RATING,
      volatility: 200.0,
      gamesPlayed: 0,
      lastUpdated: new Date(),
      confidenceInterval: 350.0,
    };
  }

  calculateKFactor(gamesPlayed: number, volatility: number): number {
    const gamesFactor = this.K_FACTOR_BASE * Math.exp(-gamesPlayed / 30.0);
    const volatilityFactor = volatility / 200.0;
    return Math.max(this.K_FACTOR_MIN, gamesFactor * volatilityFactor);
  }

  expectedScore(ratingA: number, ratingB: number): number {
    return 1.0 / (1.0 + Math.pow(10, (ratingB - ratingA) / 400.0));
  }

  updateRating(
    current: SkillRating,
    actualScore: number,
    opponentRating: number,
    domainScores?: Record<string, number>
  ): SkillRating {
    const expected = this.expectedScore(current.overallRating, opponentRating);
    const kFactor = this.calculateKFactor(current.gamesPlayed, current.volatility);
    const ratingDelta = kFactor * (actualScore - expected);
    const newOverall = current.overallRating + ratingDelta;

    const surpriseFactor = Math.abs(actualScore - expected);
    let newVolatility = current.volatility * this.VOLATILITY_DECAY;
    newVolatility += surpriseFactor * 50.0;
    newVolatility = Math.max(50.0, Math.min(300.0, newVolatility));

    const confidence = 350.0 / Math.sqrt(current.gamesPlayed + 1);

    return {
      ...current,
      overallRating: newOverall,
      volatility: newVolatility,
      gamesPlayed: current.gamesPlayed + 1,
      lastUpdated: new Date(),
      confidenceInterval: confidence,
    };
  }

  calculateMatchmakingRange(rating: SkillRating): [number, number] {
    const bandwidth = rating.volatility + rating.confidenceInterval;
    return [rating.overallRating - bandwidth, rating.overallRating + bandwidth];
  }

  estimateWinProbability(player: SkillRating, difficulty: number): number {
    return this.expectedScore(player.overallRating, difficulty);
  }

  getSkillPercentile(rating: number, allRatings: number[]): number {
    if (allRatings.length === 0) return 50.0;
    const below = allRatings.filter((r) => r < rating).length;
    return (below / allRatings.length) * 100.0;
  }

  getRatingTrend(contestantId: string, games: number = 10): number | null {
    const history = this.ratingHistory.get(contestantId);
    if (!history || history.length < 2) return null;
    
    const recent = history.slice(-games);
    if (recent.length < 2) return null;

    // Simple linear regression
    const x = Array.from({ length: recent.length }, (_, i) => i);
    const y = recent.map((r) => r.overallRating);
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  saveRatingHistory(rating: SkillRating): void {
    if (!this.ratingHistory.has(rating.contestantId)) {
      this.ratingHistory.set(rating.contestantId, []);
    }
    this.ratingHistory.get(rating.contestantId)!.push(rating);
  }
}

describe('SkillRatingEngine', () => {
  let engine: MockSkillRatingEngine;

  beforeEach(() => {
    engine = new MockSkillRatingEngine();
  });

  describe('initializeRating', () => {
    it('should create rating with base values', () => {
      const rating = engine.initializeRating('contestant-001');
      
      expect(rating.contestantId).toBe('contestant-001');
      expect(rating.overallRating).toBe(1500.0);
      expect(rating.riskAssessment).toBe(1500.0);
      expect(rating.volatility).toBe(200.0);
      expect(rating.gamesPlayed).toBe(0);
      expect(rating.confidenceInterval).toBe(350.0);
    });

    it('should initialize all domain ratings equally', () => {
      const rating = engine.initializeRating('contestant-002');
      
      expect(rating.riskAssessment).toBe(1500.0);
      expect(rating.resourceAllocation).toBe(1500.0);
      expect(rating.timingOptimization).toBe(1500.0);
      expect(rating.portfolioConstruction).toBe(1500.0);
      expect(rating.crisisResponse).toBe(1500.0);
    });
  });

  describe('calculateKFactor', () => {
    it('should decrease K-factor with more games played', () => {
      const k0 = engine.calculateKFactor(0, 200.0);
      const k30 = engine.calculateKFactor(30, 200.0);
      const k100 = engine.calculateKFactor(100, 200.0);
      
      expect(k0).toBeGreaterThan(k30);
      expect(k30).toBeGreaterThan(k100);
      expect(k100).toBeGreaterThanOrEqual(16.0); // K_FACTOR_MIN
    });

    it('should scale with volatility', () => {
      const kLow = engine.calculateKFactor(10, 100.0);
      const kHigh = engine.calculateKFactor(10, 300.0);
      
      expect(kHigh).toBeGreaterThan(kLow);
    });

    it('should never go below minimum', () => {
      const k = engine.calculateKFactor(1000, 50.0);
      expect(k).toBeGreaterThanOrEqual(16.0);
    });
  });

  describe('expectedScore', () => {
    it('should return 0.5 for equal ratings', () => {
      const expected = engine.expectedScore(1500, 1500);
      expect(expected).toBeCloseTo(0.5, 2);
    });

    it('should favor higher rating', () => {
      const expected = engine.expectedScore(1600, 1400);
      expect(expected).toBeGreaterThan(0.5);
    });

    it('should disfavor lower rating', () => {
      const expected = engine.expectedScore(1400, 1600);
      expect(expected).toBeLessThan(0.5);
    });

    it('should handle extreme rating differences', () => {
      const expected = engine.expectedScore(2000, 1000);
      expect(expected).toBeGreaterThan(0.95);
    });
  });

  describe('updateRating', () => {
    it('should increase rating after win', () => {
      const initial = engine.initializeRating('contestant-003');
      const updated = engine.updateRating(initial, 1.0, 1500);
      
      expect(updated.overallRating).toBeGreaterThan(initial.overallRating);
    });

    it('should decrease rating after loss', () => {
      const initial = engine.initializeRating('contestant-004');
      const updated = engine.updateRating(initial, 0.0, 1500);
      
      expect(updated.overallRating).toBeLessThan(initial.overallRating);
    });

    it('should increment games played', () => {
      const initial = engine.initializeRating('contestant-005');
      const updated = engine.updateRating(initial, 0.5, 1500);
      
      expect(updated.gamesPlayed).toBe(initial.gamesPlayed + 1);
    });

    it('should decay volatility over time', () => {
      let rating = engine.initializeRating('contestant-006');
      const initialVolatility = rating.volatility;
      
      // Simulate multiple expected-outcome games
      for (let i = 0; i < 10; i++) {
        rating = engine.updateRating(rating, 0.5, 1500);
      }
      
      expect(rating.volatility).toBeLessThan(initialVolatility);
    });

    it('should spike volatility on surprising results', () => {
      let rating = engine.initializeRating('contestant-007');
      rating.volatility = 100.0; // Low volatility
      
      // Upset: low-rated player beats much higher opponent
      const updated = engine.updateRating(rating, 1.0, 2000);
      
      expect(updated.volatility).toBeGreaterThan(100.0);
    });

    it('should narrow confidence interval with experience', () => {
      let rating = engine.initializeRating('contestant-008');
      const initialCI = rating.confidenceInterval;
      
      for (let i = 0; i < 20; i++) {
        rating = engine.updateRating(rating, 0.5, 1500);
      }
      
      expect(rating.confidenceInterval).toBeLessThan(initialCI);
    });
  });

  describe('calculateMatchmakingRange', () => {
    it('should return wider range for new players', () => {
      const newPlayer = engine.initializeRating('contestant-009');
      const [min, max] = engine.calculateMatchmakingRange(newPlayer);
      
      expect(max - min).toBeGreaterThan(400);
    });

    it('should return narrower range for experienced players', () => {
      let player = engine.initializeRating('contestant-010');
      
      for (let i = 0; i < 50; i++) {
        player = engine.updateRating(player, 0.5, 1500);
      }
      
      const [min, max] = engine.calculateMatchmakingRange(player);
      expect(max - min).toBeLessThan(400);
    });

    it('should center on player rating', () => {
      const player = engine.initializeRating('contestant-011');
      const [min, max] = engine.calculateMatchmakingRange(player);
      
      const center = (min + max) / 2;
      expect(center).toBeCloseTo(player.overallRating, 1);
    });
  });

  describe('estimateWinProbability', () => {
    it('should return ~50% vs equal difficulty', () => {
      const player = engine.initializeRating('contestant-012');
      const prob = engine.estimateWinProbability(player, 1500);
      
      expect(prob).toBeCloseTo(0.5, 1);
    });

    it('should return high probability vs easy difficulty', () => {
      const player = engine.initializeRating('contestant-013');
      player.overallRating = 1800;
      
      const prob = engine.estimateWinProbability(player, 1200);
      expect(prob).toBeGreaterThan(0.9);
    });

    it('should return low probability vs hard difficulty', () => {
      const player = engine.initializeRating('contestant-014');
      const prob = engine.estimateWinProbability(player, 2000);
      
      expect(prob).toBeLessThan(0.1);
    });
  });

  describe('getSkillPercentile', () => {
    it('should return 50% for empty population', () => {
      const percentile = engine.getSkillPercentile(1500, []);
      expect(percentile).toBe(50.0);
    });

    it('should calculate correct percentile', () => {
      const allRatings = [1200, 1300, 1400, 1500, 1600, 1700, 1800];
      
      const p25 = engine.getSkillPercentile(1300, allRatings);
      const p50 = engine.getSkillPercentile(1500, allRatings);
      const p75 = engine.getSkillPercentile(1700, allRatings);
      
      expect(p25).toBeCloseTo(14.3, 0);
      expect(p50).toBeCloseTo(42.9, 0);
      expect(p75).toBeCloseTo(71.4, 0);
    });

    it('should return 100% for highest rating', () => {
      const allRatings = [1200, 1400, 1600, 1800];
      const percentile = engine.getSkillPercentile(2000, allRatings);
      
      expect(percentile).toBe(100.0);
    });

    it('should return 0% for lowest rating', () => {
      const allRatings = [1200, 1400, 1600, 1800];
      const percentile = engine.getSkillPercentile(1000, allRatings);
      
      expect(percentile).toBe(0.0);
    });
  });

  describe('getRatingTrend', () => {
    it('should return null for players without history', () => {
      const trend = engine.getRatingTrend('nonexistent');
      expect(trend).toBeNull();
    });

    it('should return null for insufficient history', () => {
      let rating = engine.initializeRating('contestant-015');
      engine.saveRatingHistory(rating);
      
      const trend = engine.getRatingTrend('contestant-015');
      expect(trend).toBeNull();
    });

    it('should detect positive trend', () => {
      let rating = engine.initializeRating('contestant-016');
      
      // Simulate improving player
      for (let i = 0; i < 10; i++) {
        rating = engine.updateRating(rating, 0.7, 1500);
        engine.saveRatingHistory(rating);
      }
      
      const trend = engine.getRatingTrend('contestant-016');
      expect(trend).not.toBeNull();
      expect(trend!).toBeGreaterThan(0);
    });

    it('should detect negative trend', () => {
      let rating = engine.initializeRating('contestant-017');
      
      // Simulate declining player
      for (let i = 0; i < 10; i++) {
        rating = engine.updateRating(rating, 0.3, 1500);
        engine.saveRatingHistory(rating);
      }
      
      const trend = engine.getRatingTrend('contestant-017');
      expect(trend).not.toBeNull();
      expect(trend!).toBeLessThan(0);
    });
  });

  describe('Rating System Integration', () => {
    it('should handle full game lifecycle', () => {
      // New player joins
      let player = engine.initializeRating('integration-test');
      expect(player.gamesPlayed).toBe(0);
      expect(player.overallRating).toBe(1500);
      
      // Plays 10 games with varying outcomes
      const outcomes = [1.0, 0.0, 1.0, 1.0, 0.5, 1.0, 0.0, 1.0, 1.0, 0.5];
      
      for (const outcome of outcomes) {
        player = engine.updateRating(player, outcome, 1500);
        engine.saveRatingHistory(player);
      }
      
      // Should have played 10 games
      expect(player.gamesPlayed).toBe(10);
      
      // Rating should reflect 70% win rate
      expect(player.overallRating).toBeGreaterThan(1500);
      
      // Volatility should have decreased
      expect(player.volatility).toBeLessThan(200.0);
      
      // Should have positive trend
      const trend = engine.getRatingTrend('integration-test');
      expect(trend).not.toBeNull();
      expect(trend!).toBeGreaterThan(0);
    });
  });
});
