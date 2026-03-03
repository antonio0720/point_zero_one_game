/**
 * CardRecommender — src/ml/CardRecommender.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #10: Contextual Bandit Card Recommender
 *
 * Advisory only — never autopilot. Recommendations are suggestions,
 * skill stays sovereign. Bandit learns which cards perform best
 * in each (pressure tier, timing class) context.
 */

import type { IntelligenceOutput } from './PlayerModelEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimingClass = 'FATE' | 'CTR' | 'GBM' | 'PHZ' | 'FREE';

export interface CardContext {
  pressureTier:    1 | 2 | 3 | 4 | 5;
  timingClass:     TimingClass;
  cashAvailable:   number;
  obligationRatio: number;
  portfolioHhi:    number;
  biasActive:      boolean;
  ticksRemaining:  number;
}

export interface CardOption {
  cardId:          string;
  cardName:        string;
  cost:            number;
  assetClass:      string;
  zone:            string;
  educationalTag:  string;
  estimatedValue:  number;
  estimatedCf:     number;
}

export interface Recommendation {
  cardId:      string;
  cardName:    string;
  confidence:  number;   // 0–1
  reason:      string;
  action:      'PLAY_NOW' | 'HOLD' | 'PLAY_SOON';
  urgency:     'IMMEDIATE' | 'SOON' | 'OPTIONAL';
}

// ─── Bandit State ─────────────────────────────────────────────────────────────

interface ArmState {
  cardId:    string;
  pulls:     number;
  totalRew:  number;
  meanRew:   number;
}

// UCB1 bandit — Upper Confidence Bound
function ucb1Score(arm: ArmState, totalPulls: number): number {
  if (arm.pulls === 0) return Infinity;
  return arm.meanRew + Math.sqrt((2 * Math.log(totalPulls + 1)) / arm.pulls);
}

// ─── Recommender ──────────────────────────────────────────────────────────────

export class CardRecommender {
  /** Bandit arms keyed by contextKey + cardId */
  private arms = new Map<string, ArmState>();
  private totalPulls = 0;

  private contextKey(ctx: CardContext): string {
    return `${ctx.pressureTier}:${ctx.timingClass}:${ctx.biasActive ? 'B' : 'N'}`;
  }

  private getArm(contextKey: string, cardId: string): ArmState {
    const key = `${contextKey}::${cardId}`;
    if (!this.arms.has(key)) {
      this.arms.set(key, { cardId, pulls: 0, totalRew: 0, meanRew: 0.5 });
    }
    return this.arms.get(key)!;
  }

  /**
   * Record outcome of a card play for bandit learning.
   * reward: 0–1 (1 = played correctly, generated cashflow, no bad outcome)
   */
  recordOutcome(ctx: CardContext, cardId: string, reward: number): void {
    const key  = this.contextKey(ctx);
    const arm  = this.getArm(key, cardId);
    arm.pulls++;
    arm.totalRew += reward;
    arm.meanRew = arm.totalRew / arm.pulls;
    this.totalPulls++;
  }

  /**
   * Get top-2 recommendations from available cards.
   * Advisory only — player decides.
   */
  recommend(
    ctx:     CardContext,
    options: CardOption[],
    intel:   IntelligenceOutput,
    topN = 2,
  ): Recommendation[] {
    const key = this.contextKey(ctx);

    // Filter by affordability
    const affordable = options.filter(c => c.cost <= ctx.cashAvailable * 0.8);
    if (affordable.length === 0) {
      return [{ cardId: '', cardName: '', confidence: 0.3, reason: 'Insufficient cash for any card', action: 'HOLD', urgency: 'OPTIONAL' }];
    }

    // Score each option via UCB1 + contextual heuristics
    const scored = affordable.map(card => {
      const arm    = this.getArm(key, card.cardId);
      const ucb    = ucb1Score(arm, this.totalPulls);
      const heur   = computeHeuristic(card, ctx, intel);
      const score  = arm.pulls > 5 ? ucb * 0.6 + heur * 0.4 : heur;
      return { card, score };
    }).sort((a, b) => b.score - a.score);

    return scored.slice(0, topN).map(({ card, score }) => {
      const confidence = Math.min(0.95, 0.5 + score * 0.4);
      const action: Recommendation['action'] =
        ctx.pressureTier >= 4 ? 'PLAY_NOW' :
        ctx.timingClass !== 'FREE' && confidence > 0.7 ? 'PLAY_NOW' : 'HOLD';

      return {
        cardId:    card.cardId,
        cardName:  card.cardName,
        confidence,
        reason:    buildReason(card, ctx, intel),
        action,
        urgency:   ctx.pressureTier >= 4 ? 'IMMEDIATE' : ctx.pressureTier >= 3 ? 'SOON' : 'OPTIONAL',
      };
    });
  }
}

function computeHeuristic(card: CardOption, ctx: CardContext, intel: IntelligenceOutput): number {
  let score = 0.5;

  // Cashflow priority when bankruptcy risk is high
  if (intel.bankruptcyRisk60 > 0.4 && card.estimatedCf > 0) {
    score += 0.2;
  }

  // Diversification priority when HHI is high
  if (ctx.portfolioHhi > 0.6) {
    score += 0.1;
  }

  // Bias active — reduce score for high-risk cards
  if (ctx.biasActive && card.zone === 'SCALE') {
    score -= 0.2;
  }

  // Timing class alignment
  if (ctx.timingClass === 'GBM' && card.zone === 'FLIP') score += 0.15;
  if (ctx.timingClass === 'CTR' && card.zone === 'SCALE') score += 0.1;

  return Math.max(0, Math.min(1, score));
}

function buildReason(card: CardOption, ctx: CardContext, intel: IntelligenceOutput): string {
  if (intel.bankruptcyRisk60 > 0.5) return `Cashflow priority — bankruptcy risk at ${Math.round(intel.bankruptcyRisk60 * 100)}%`;
  if (ctx.portfolioHhi > 0.6) return `Diversification play — portfolio is overconcentrated`;
  if (ctx.pressureTier >= 4) return `High-pressure window — optimal card for tier ${ctx.pressureTier}`;
  if (ctx.timingClass !== 'FREE') return `${ctx.timingClass} window active — best alignment`;
  return `Highest expected value for current run state`;
}