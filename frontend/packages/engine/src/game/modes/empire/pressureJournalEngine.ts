/**
 * pressureJournalEngine.ts — Empire Mode Decision Journal
 * Point Zero One · Density6 LLC · Confidential
 *
 * Tracks and categorizes every player decision for the post-run
 * "Pressure Journal" — a cause-of-death / cause-of-victory analysis.
 */

// ─── Decision Tag Types ───────────────────────────────────────────────────────

export type DecisionTag =
  | 'INCOME_PLAY'
  | 'EXPENSE_CUT'
  | 'SHIELD_PLAY'
  | 'AGGRESSIVE_PLAY'
  | 'DEFENSIVE_PLAY'
  | 'MISSED_WINDOW'
  | 'FORCED_CARD'
  | 'OPTIMAL_TIMING'
  | 'POOR_TIMING'
  | 'RECOVERY_PLAY'
  | 'LEVERAGE_PLAY';

export const DECISION_TAG_COLORS: Record<DecisionTag, string> = {
  INCOME_PLAY:     '#22DD88',
  EXPENSE_CUT:     '#4A9EFF',
  SHIELD_PLAY:     '#00D4B8',
  AGGRESSIVE_PLAY: '#FF9B2F',
  DEFENSIVE_PLAY:  '#818CF8',
  MISSED_WINDOW:   '#FF4D4D',
  FORCED_CARD:     '#FF1744',
  OPTIMAL_TIMING:  '#C9A84C',
  POOR_TIMING:     '#FF6B6B',
  RECOVERY_PLAY:   '#A855F7',
  LEVERAGE_PLAY:   '#E040FB',
};

export const DECISION_TAG_ICONS: Record<DecisionTag, string> = {
  INCOME_PLAY:     '💰',
  EXPENSE_CUT:     '✂️',
  SHIELD_PLAY:     '🛡️',
  AGGRESSIVE_PLAY: '⚔️',
  DEFENSIVE_PLAY:  '🏰',
  MISSED_WINDOW:   '❌',
  FORCED_CARD:     '⚡',
  OPTIMAL_TIMING:  '🎯',
  POOR_TIMING:     '⏰',
  RECOVERY_PLAY:   '🔄',
  LEVERAGE_PLAY:   '📈',
};

// ─── Journal Entry ────────────────────────────────────────────────────────────

export interface PressureJournalEntry {
  tick:        number;
  cardId:      string;
  tag:         DecisionTag;
  impact:      number;
  description: string;
  wasForced:   boolean;
}

export function tagDecision(
  cardType: string, wasForced: boolean, incomeEffect: number, expenseEffect: number,
): DecisionTag {
  if (wasForced) return 'FORCED_CARD';
  if (incomeEffect > 0) return 'INCOME_PLAY';
  if (expenseEffect < 0) return 'EXPENSE_CUT';
  if (cardType.includes('SHIELD')) return 'SHIELD_PLAY';
  if (incomeEffect > 500) return 'AGGRESSIVE_PLAY';
  return 'DEFENSIVE_PLAY';
}
