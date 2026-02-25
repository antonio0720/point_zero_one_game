// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/cards.ts
// Sprint 0: Canonical Card Type Contracts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import type { GameMode } from './modes';

// ── Card Archetypes ───────────────────────────────────────────────────────────
/** Primary deck type — drives policy engine routing. */
export type CardArchetype =
  | 'OPPORTUNITY'       // Long-game builder. Player-initiated.
  | 'IPA'               // Income Producing Asset. Passive cashflow boost.
  | 'FUBAR'             // Systemic hazard. Event-driven only — NOT manually playable.
  | 'MISSED_OPPORTUNITY'// Forced freeze. Event-driven only.
  | 'SO'                // Systemic Obstacle. Event-driven. Unpredictable resolution.
  | 'PRIVILEGED';       // Unfair advantage. Net-worth spike.

/** Whether a card type can be manually played by the user. */
export const CARD_MANUALLY_PLAYABLE: Record<CardArchetype, boolean> = {
  OPPORTUNITY:         true,
  IPA:                 true,
  FUBAR:               false,   // enters via forcedEventEngine only
  MISSED_OPPORTUNITY:  false,   // enters via forcedEventEngine only
  SO:                  false,   // enters via forcedEventEngine only
  PRIVILEGED:          true,
};

// ── Card Origin ───────────────────────────────────────────────────────────────
/** Where a card entered the game state. */
export type CardOrigin =
  | 'PLAYER_DRAW'         // Normal draw from deck
  | 'FORCED_EVENT'        // Spawned by forcedEventEngine
  | 'SABOTAGE_INJECTION'  // Predator: opponent fired sabotage
  | 'EXTRACTION_RESULT'   // Predator: won an extraction window
  | 'RESCUE_REWARD'       // Syndicate: teammate rescue completed
  | 'GHOST_PRESSURE'      // Phantom: legend gap trigger
  | 'BONUS_DRAW';         // Mechanic/synergy triggered bonus

// ── Card Visibility ───────────────────────────────────────────────────────────
/** Who can see this card in multiplayer contexts. */
export type CardVisibility = 'SELF' | 'ALL' | 'OPPONENT_ONLY';

// ── Forced Event Types ────────────────────────────────────────────────────────
export type ForcedEventType =
  | 'FUBAR_HIT'
  | 'MISSED_WINDOW'
  | 'OBSTACLE_SPAWN'
  | 'SABOTAGE_INJECT'
  | 'LEGEND_PRESSURE'
  | 'ISOLATION_TAX'   // EMPIRE only
  | 'BLEED_TICK';     // EMPIRE only when in bleed mode

// ── Core Card Shape ───────────────────────────────────────────────────────────
export interface GameCard {
  id: string;
  name: string;
  type: CardArchetype;
  subtype: string;
  description: string;
  origin: CardOrigin;
  visibility: CardVisibility;

  // Economy fields (null when not applicable)
  cost: number | null;
  leverage: number | null;
  downPayment: number | null;
  cashflowMonthly: number | null;
  roiPct: number | null;
  cashImpact: number | null;
  turnsLost: number | null;
  value: number | null;
  energyCost: number;
  synergies: string[];

  // Mode-aware fields added by adapters
  modeMetadata?: ModeCardMetadata;
}

// ── Mode-Specific Card Metadata ───────────────────────────────────────────────
/** Appended by mode adapters — modifies how the card scores and resolves. */
export interface ModeCardMetadata {
  mode: GameMode;
  // Predator
  selfValue?: number;    // economy gain to self
  denyValue?: number;    // value of preventing opponent from getting it
  bbGeneration?: number; // battle budget generated if active
  // Syndicate
  trustImpact?: number;         // +/- to trust score on play
  recipientPreview?: string;    // description of teammate-side effect
  defectionSignature?: boolean; // marks card as part of defection sequence
  // Phantom
  cordDelta?: number;            // change in CORD basis points vs legend path
  legendPressureResponse?: boolean; // card counters legend pressure
  // Empire
  isolationTaxModifier?: number; // multiplier on isolation tax for this play
  bleedAmplifier?: boolean;      // amplifies if in bleed mode
  comebackEligible?: boolean;    // eligible for comeback surge bonus
  // Decision archive tag
  decisionTag?: 'FAST' | 'LATE' | 'OPTIMAL' | 'RISKY';
}

// ── Card Valuation Input ──────────────────────────────────────────────────────
/** Context fed into cardValuation.ts for mode-aware scoring. */
export interface CardValuationContext {
  mode: GameMode;
  cash: number;
  netWorth: number;
  income: number;
  expenses: number;
  tick: number;
  shields: number;
  pressureScore: number;    // 0.0–1.0 from PressureEngine
  // Predator
  battleBudget?: number;
  opponentCash?: number;
  // Phantom
  cordGap?: number;         // current delta vs legend path
  // Empire
  inBleedMode?: boolean;
}
