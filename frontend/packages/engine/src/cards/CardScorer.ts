//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/CardScorer.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARD SCORER
// pzo-web/src/engines/cards/CardScorer.ts
//
// Computes decision quality per card play.
// Produces a DecisionRecord fed into RunStateSnapshot.decisionsThisTick
// and accumulated in the SovereigntyEngine for the post-run Case File.
//
// THREE SCORING DIMENSIONS:
//
//   speedScore    — How quickly the player resolved within the window.
//                   Sourced directly from ResolvedWindowRecord.speedScore.
//                   0.0 for auto-resolved (expired) cards.
//
//   timingScore   — Was the card played in its ideal timing window?
//                   1.0 = played within the first 40% of the window.
//                   Decays linearly to 0.3 as window fills.
//                   0.0 if auto-resolved or played in final 10%.
//
//   choiceScore   — Was this the highest-CORD option available?
//                   1.0 = optimal. 0.0 = worst available.
//                   Interpolated between options by cordDelta rank.
//
//   compositeScore — Weighted average:
//                   speed: 30%, timing: 30%, choice: 40%
//                   This weights the decision quality (choice) highest.
//
// CORD CONTRIBUTION:
//   cordContribution = totalCordDelta from CardEffectResult
//                      × compositeScore × overlay.cord_weight
//   This means a correct card played at the wrong time contributes less CORD
//   than the same card played at the right moment.
//
// RULES:
//   ✦ CardScorer is stateless — one method, one result.
//   ✦ It never emits events. CardUXBridge and CardEngine consume its output.
//   ✦ choiceScore requires knowing available alternatives.
//     CardEngine provides the current hand state so CardScorer can rank.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  TimingClass,
  type CardInHand,
  type CardEffectResult,
  type DecisionRecord,
} from './types';
import type { ResolvedWindowRecord, ExpiredWindowRecord } from './DecisionWindowManager';

// ── SCORE WEIGHTS ──────────────────────────────────────────────────────────────

const SPEED_WEIGHT  = 0.30;
const TIMING_WEIGHT = 0.30;
const CHOICE_WEIGHT = 0.40;

// ── OPTIMAL TIMING THRESHOLD ───────────────────────────────────────────────────
// Fraction of window used where timing is still considered "ideal"
const OPTIMAL_TIMING_RATIO = 0.40;

// ═══════════════════════════════════════════════════════════════════════════════
// CARD SCORER
// ═══════════════════════════════════════════════════════════════════════════════

export class CardScorer {

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE A RESOLVED PLAY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Score a card play that was resolved by the player before the window expired.
   *
   * @param card          - CardInHand being played
   * @param resolved      - Timing data from DecisionWindowManager
   * @param effectResult  - Mechanical output from CardEffectResolver
   * @param handSnapshot  - Current hand (used to compute choiceScore — was this optimal?)
   * @param tickIndex     - Current tick
   */
  public scoreResolvedPlay(
    card:         CardInHand,
    resolved:     ResolvedWindowRecord,
    effectResult: CardEffectResult,
    handSnapshot: readonly CardInHand[],
    tickIndex:    number,
  ): DecisionRecord {
    const speedScore  = resolved.speedScore;
    const timingScore = this.computeTimingScore(resolved.resolvedInMs, resolved.durationMs, card);
    const choiceScore = this.computeChoiceScore(card, effectResult, handSnapshot);

    const compositeScore = this.computeComposite(speedScore, timingScore, choiceScore);
    const cordContribution = this.computeCordContribution(effectResult, compositeScore, card);

    return {
      cardId:            card.definition.cardId,
      instanceId:        card.instanceId,
      decisionWindowMs:  resolved.durationMs,
      resolvedInMs:      resolved.resolvedInMs,
      wasAutoResolved:   false,
      wasOptimalChoice:  effectResult.isOptimalChoice,
      speedScore,
      timingScore,
      choiceScore,
      compositeScore,
      cordContribution,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE AN AUTO-RESOLVED (EXPIRED) PLAY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Score a card that expired without player action.
   * Speed, timing, and choice scores are all 0.0.
   * CORD contribution is negative (worst option was taken).
   *
   * @param card         - CardInHand that expired
   * @param expired      - Expiry record from DecisionWindowManager
   * @param effectResult - Effect of the auto-resolved worst option
   * @param tickIndex    - Current tick
   */
  public scoreAutoResolved(
    card:         CardInHand,
    expired:      ExpiredWindowRecord,
    effectResult: CardEffectResult,
    tickIndex:    number,
  ): DecisionRecord {
    const compositeScore   = 0.0;
    const cordContribution = this.computeCordContribution(effectResult, compositeScore, card);

    return {
      cardId:            card.definition.cardId,
      instanceId:        card.instanceId,
      decisionWindowMs:  0,  // window fully consumed — zero remaining
      resolvedInMs:      card.decisionWindowId === null ? 0 : Infinity,
      wasAutoResolved:   true,
      wasOptimalChoice:  false,
      speedScore:        0.0,
      timingScore:       0.0,
      choiceScore:       0.0,
      compositeScore:    0.0,
      cordContribution,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: TIMING SCORE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Timing score measures ideal window utilization.
   *
   * Curve:
   *   ≤40% window used  → 1.0 (inside ideal window)
   *   40%–90% used      → 1.0 → 0.3 (linear decay)
   *   90%–100% used     → 0.3 → 0.0 (last 10% = desperation zone)
   *   IMMEDIATE/LEGENDARY → always 1.0 (no window constraint)
   */
  private computeTimingScore(
    resolvedInMs: number,
    durationMs:   number,
    card:         CardInHand,
  ): number {
    const tc = card.definition.timingClass;

    // Cards with no timing window always get full timing score
    if (
      tc === TimingClass.IMMEDIATE ||
      tc === TimingClass.LEGENDARY  ||
      durationMs <= 0
    ) {
      return 1.0;
    }

    const ratio = Math.min(1, resolvedInMs / durationMs);

    if (ratio <= OPTIMAL_TIMING_RATIO) return 1.0;
    if (ratio <= 0.90) return 1.0 - ((ratio - OPTIMAL_TIMING_RATIO) / (0.90 - OPTIMAL_TIMING_RATIO)) * 0.70;
    return Math.max(0, 0.30 - ((ratio - 0.90) / 0.10) * 0.30);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: CHOICE SCORE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Choice score ranks the played card by CORD delta relative to all other
   * playable cards in the current hand. Optimal = 1.0, worst = 0.0.
   *
   * If the hand has only one card, score is 1.0 (no alternative).
   * If CardEffectResult.isOptimalChoice is already computed, use it directly.
   */
  private computeChoiceScore(
    card:         CardInHand,
    effectResult: CardEffectResult,
    hand:         readonly CardInHand[],
  ): number {
    // If CardEffectResolver already determined optimality, trust it
    if (effectResult.isOptimalChoice) return 1.0;

    const playableCount = hand.filter(c => !c.isHeld && !c.isForced).length;
    if (playableCount <= 1) return 1.0;

    // Simple heuristic: rank by effectiveCost proxy for CORD potential
    // In a full implementation this would use the CardEffectResolver to
    // simulate alternatives — here we approximate with cost ranking.
    const playedCost = card.effectiveCost;
    const allCosts = hand
      .filter(c => !c.isHeld)
      .map(c => c.effectiveCost)
      .sort((a, b) => b - a); // descending — higher cost ≈ higher potential

    const rank = allCosts.indexOf(playedCost);
    if (rank < 0) return 0.5;

    // rank 0 = best available = 1.0, rank (n-1) = worst = 0.0
    return Math.max(0, 1.0 - rank / (allCosts.length - 1));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: COMPOSITE + CORD CONTRIBUTION
  // ═══════════════════════════════════════════════════════════════════════════

  private computeComposite(speed: number, timing: number, choice: number): number {
    const composite = speed * SPEED_WEIGHT + timing * TIMING_WEIGHT + choice * CHOICE_WEIGHT;
    return parseFloat(composite.toFixed(4));
  }

  /**
   * Final CORD contribution for this card play.
   *
   * Formula:
   *   cordContribution = effectResult.totalCordDelta
   *                      × compositeScore
   *                      × overlay.cord_weight
   *
   * compositeScore acts as a quality multiplier — a correct card played sloppily
   * yields less CORD than the same card played at the optimal moment.
   */
  private computeCordContribution(
    effectResult:    CardEffectResult,
    compositeScore:  number,
    card:            CardInHand,
  ): number {
    const raw = effectResult.totalCordDelta * compositeScore * card.overlay.cord_weight;
    return parseFloat(raw.toFixed(6));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH SUMMARY (for RunStateSnapshot)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compute the aggregate decision quality score for a tick's decisions.
   * This is the single value that feeds RunStateSnapshot.decisionQualityThisTick.
   *
   * Returns 1.0 if no decisions were made this tick.
   */
  public aggregateTickScore(records: DecisionRecord[]): number {
    if (records.length === 0) return 1.0;
    const sum = records.reduce((acc, r) => acc + r.compositeScore, 0);
    return parseFloat((sum / records.length).toFixed(4));
  }

  /**
   * Total CORD delta from all decisions this tick.
   */
  public totalCordDelta(records: DecisionRecord[]): number {
    return parseFloat(records.reduce((acc, r) => acc + r.cordContribution, 0).toFixed(6));
  }
}