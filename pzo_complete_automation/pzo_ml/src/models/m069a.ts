/**
 * M69a — Choice Drill Generator + Skill Rating (Micro-Sim Tests)
 * PZO_T00333 | Phase: PZO_P05_ML_MONETIZATION
 * File: pzo_ml/src/models/m069a.ts
 * Enforces: bounded nudges + audit_hash + ml_enabled kill-switch
 */

import { createHash } from 'crypto';

let ML_ENABLED = true;
export function setMLEnabled(enabled: boolean): void { ML_ENABLED = enabled; }
export function isMLEnabled(): boolean { return ML_ENABLED; }

export type DrillCategory = 'liquidity' | 'leverage' | 'timing' | 'diversification' | 'negotiation';
export type DifficultyTier = 'novice' | 'apprentice' | 'expert' | 'master';

export interface DrillOption {
  optionId: string;
  description: string;
  isOptimal: boolean;
  partialCredit: number;   // 0–1
  feedbackText: string;
}

export interface ChoiceDrill {
  drillId: string;
  category: DrillCategory;
  difficulty: DifficultyTier;
  scenario: string;
  options: DrillOption[];
  timeAllowedSeconds: number;
  mechanicIds: string[];    // referenced PZO mechanics
  skillWeightBP: number;    // contribution to skill rating (bounded 0–500)
}

export interface DrillAttempt {
  attemptId: string;
  playerId: string;
  drillId: string;
  selectedOptionId: string;
  timeSpentSeconds: number;
  turn: number;
  scoreEarned: number;      // 0–1
  auditHash: string;
}

export interface SkillRating {
  playerId: string;
  overall: number;          // 0–1000 Elo-like
  byCategory: Record<DrillCategory, number>;
  totalAttempts: number;
  streak: number;
  lastUpdatedTurn: number;
}

// ── Drill Generation ─────────────────────────────────────────────────────────
const DRILL_TEMPLATES: ChoiceDrill[] = [
  {
    drillId: 'D_LIQ_001',
    category: 'liquidity',
    difficulty: 'novice',
    scenario: 'You need $50K in 1 turn. You hold: $30K cash, $40K in Bonds (2-turn lock), $50K in Hard Assets (5-turn lock). What do you liquidate?',
    options: [
      { optionId: 'A', description: 'All cash + force-sell hard asset', isOptimal: false, partialCredit: 0.2, feedbackText: 'Force-selling hard assets incurs 2× penalty — extremely costly.' },
      { optionId: 'B', description: 'All cash + force-sell bonds', isOptimal: true, partialCredit: 1.0, feedbackText: 'Correct — bonds have lower forced-sell penalty than hard assets.' },
      { optionId: 'C', description: 'Sell hard assets only', isOptimal: false, partialCredit: 0.0, feedbackText: 'Hard assets are tier 4 — maximum penalty + still short $0.' },
      { optionId: 'D', description: 'Borrow against hard assets', isOptimal: false, partialCredit: 0.5, feedbackText: 'Viable but adds leverage — not optimal if bonds cover the gap.' },
    ],
    timeAllowedSeconds: 45,
    mechanicIds: ['M32'],
    skillWeightBP: 100,
  },
  {
    drillId: 'D_LEV_001',
    category: 'leverage',
    difficulty: 'apprentice',
    scenario: 'Leverage ratio is 3.2×. Acquisition target requires 4.5× debt. Market is in contraction phase. Do you proceed?',
    options: [
      { optionId: 'A', description: 'Proceed — high reward justifies risk', isOptimal: false, partialCredit: 0.1, feedbackText: 'Contraction phase amplifies downside — 4.5× in contraction is a liquidation trap.' },
      { optionId: 'B', description: 'Decline — wait for expansion phase', isOptimal: true, partialCredit: 1.0, feedbackText: 'Correct — leverage timing with cycles is core PZO doctrine.' },
      { optionId: 'C', description: 'Proceed at 50% stake only', isOptimal: false, partialCredit: 0.6, feedbackText: 'Partial stake reduces exposure but still adds leverage in wrong cycle.' },
      { optionId: 'D', description: 'Syndicate the deal to dilute leverage', isOptimal: false, partialCredit: 0.7, feedbackText: 'Good instinct — M51 syndication helps but doesn\'t fix cycle timing.' },
    ],
    timeAllowedSeconds: 60,
    mechanicIds: ['M51'],
    skillWeightBP: 200,
  },
];

export function getDrillForPlayer(
  rating: SkillRating,
  category?: DrillCategory
): ChoiceDrill | null {
  if (!ML_ENABLED) return null;

  const targetDifficulty = ratingToDifficulty(rating.overall);
  const pool = category
    ? DRILL_TEMPLATES.filter(d => d.category === category)
    : DRILL_TEMPLATES;

  const matched = pool.find(d => d.difficulty === targetDifficulty) ?? pool[0] ?? null;
  return matched;
}

export function scoreAttempt(
  drill: ChoiceDrill,
  selectedOptionId: string,
  timeSpentSeconds: number
): number {
  const option = drill.options.find(o => o.optionId === selectedOptionId);
  if (!option) return 0;
  let score = option.partialCredit;
  // Speed bonus: up to 10% for answering in <50% of time allowed
  if (timeSpentSeconds < drill.timeAllowedSeconds * 0.5) {
    score = Math.min(1.0, score + 0.1);
  }
  return parseFloat(score.toFixed(4));
}

export function recordAttempt(
  rating: SkillRating,
  drill: ChoiceDrill,
  attemptId: string,
  selectedOptionId: string,
  timeSpentSeconds: number,
  turn: number
): DrillAttempt {
  const scoreEarned = ML_ENABLED ? scoreAttempt(drill, selectedOptionId, timeSpentSeconds) : 0;

  // Update skill rating (bounded Elo-like delta)
  if (ML_ENABLED) {
    const delta = computeRatingDelta(rating.overall, drill.difficulty, scoreEarned, drill.skillWeightBP);
    rating.overall = Math.max(0, Math.min(1000, rating.overall + delta));
    rating.byCategory[drill.category] = Math.max(
      0, Math.min(1000, (rating.byCategory[drill.category] ?? 500) + delta)
    );
    rating.totalAttempts++;
    rating.streak = scoreEarned >= 0.8 ? rating.streak + 1 : 0;
    rating.lastUpdatedTurn = turn;
  }

  const auditHash = createHash('sha256')
    .update(JSON.stringify({ attemptId, playerId: rating.playerId, drillId: drill.drillId, selectedOptionId, scoreEarned, turn }))
    .digest('hex').slice(0, 16);

  return { attemptId, playerId: rating.playerId, drillId: drill.drillId, selectedOptionId, timeSpentSeconds, turn, scoreEarned, auditHash };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function ratingToDifficulty(rating: number): DifficultyTier {
  if (rating < 300) return 'novice';
  if (rating < 600) return 'apprentice';
  if (rating < 850) return 'expert';
  return 'master';
}

function computeRatingDelta(
  currentRating: number,
  difficulty: DifficultyTier,
  score: number,
  weightBP: number
): number {
  const difficultyMultiplier: Record<DifficultyTier, number> = {
    novice: 0.5, apprentice: 1.0, expert: 1.5, master: 2.0,
  };
  const rawDelta = (score - 0.5) * (weightBP / 100) * difficultyMultiplier[difficulty];
  // Bounded nudge: max ±500 BP but rating delta capped at ±50 per attempt
  return Math.max(-50, Math.min(50, Math.round(rawDelta)));
}

export function initSkillRating(playerId: string): SkillRating {
  return {
    playerId,
    overall: 500,
    byCategory: {
      liquidity: 500, leverage: 500, timing: 500, diversification: 500, negotiation: 500,
    },
    totalAttempts: 0,
    streak: 0,
    lastUpdatedTurn: 0,
  };
}
