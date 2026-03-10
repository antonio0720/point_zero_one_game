// pzo-web/src/game/modes/empire/pressureJournalEngine.ts

/**
 * pressureJournalEngine.ts — Empire UI decision-tag helpers
 *
 * Lightweight UI-only helper module for Empire surfaces.
 * This is not an engine runtime. It exists to provide a stable
 * decision-tag contract for EmpireGameScreen and related UI.
 *
 * FILE LOCATION: pzo-web/src/game/modes/empire/pressureJournalEngine.ts
 * Density6 LLC · Confidential
 */

export type DecisionTag =
  | 'EXPAND'
  | 'DEFEND'
  | 'COUNTER'
  | 'STABILIZE'
  | 'CUT'
  | 'HOLD'
  | 'ABSORB'
  | 'RECOVER'
  | 'UNKNOWN';

export const DECISION_TAG_COLORS: Record<DecisionTag, string> = {
  EXPAND: '#2EE89A',
  DEFEND: '#4A9EFF',
  COUNTER: '#FF9B2F',
  STABILIZE: '#C9A84C',
  CUT: '#FF4D4D',
  HOLD: '#9B7DFF',
  ABSORB: '#00C9A7',
  RECOVER: '#E040FB',
  UNKNOWN: '#C9A84C',
};

export const DECISION_TAG_ICONS: Record<DecisionTag, string> = {
  EXPAND: '▲',
  DEFEND: '🛡',
  COUNTER: '✦',
  STABILIZE: '◼',
  CUT: '✕',
  HOLD: '⏸',
  ABSORB: '◌',
  RECOVER: '↺',
  UNKNOWN: '•',
};

export function normalizeDecisionTag(value: string | null | undefined): DecisionTag {
  switch (value) {
    case 'EXPAND':
    case 'DEFEND':
    case 'COUNTER':
    case 'STABILIZE':
    case 'CUT':
    case 'HOLD':
    case 'ABSORB':
    case 'RECOVER':
    case 'UNKNOWN':
      return value;
    default:
      return 'UNKNOWN';
  }
}

export function inferDecisionTagFromInjectionType(
  injectionType: string | null | undefined,
): DecisionTag {
  switch (injectionType) {
    case 'FORCED_SALE':
      return 'CUT';
    case 'REGULATORY_HOLD':
      return 'HOLD';
    case 'INVERSION_CURSE':
      return 'COUNTER';
    case 'EXPENSE_SPIKE':
      return 'STABILIZE';
    case 'DILUTION_NOTICE':
      return 'DEFEND';
    case 'HATER_HEAT_SURGE':
      return 'ABSORB';
    default:
      return 'UNKNOWN';
  }
}