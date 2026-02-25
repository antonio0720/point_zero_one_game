// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/events.ts
// Sprint 0: Run Event Discriminated Union
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import type { GameMode } from './modes';
import type { CardArchetype, GameCard } from './cards';
import type { MarketRegime, BattlePhase, SabotageKind } from './runState';

// ── Run Lifecycle Events ──────────────────────────────────────────────────────
export type RunEvent =
  | { type: 'RUN_START';       mode: GameMode; seed: number }
  | { type: 'RUN_COMPLETE';    outcome: RunOutcome; tick: number }
  | { type: 'TICK_ADVANCE';    tick: number }
  | { type: 'SCREEN_TRANSITION'; to: 'run' | 'result' | 'bankrupt' | 'landing' }

  // Card events
  | { type: 'CARD_PLAY_REQUESTED'; cardId: string }
  | { type: 'CARD_PLAY_RESOLVED';  card: GameCard; cashDelta: number; incomeDelta: number; netWorthDelta: number }
  | { type: 'CARD_PLAY_REJECTED';  cardId: string; reason: 'INSUFFICIENT_CASH' | 'NOT_MANUALLY_PLAYABLE' | 'POLICY_DENIED' }
  | { type: 'CARD_DRAWN';          card: GameCard }
  | { type: 'CARD_FUBAR_BLOCKED';  cardId: string; shieldSpent: boolean }

  // Forced event system
  | { type: 'FORCED_EVENT_TRIGGERED'; eventType: ForcedEventType; cardId: string }
  | { type: 'COUNTERPLAY_OFFERED';    eventLabel: string; adjustedHit: number }
  | { type: 'COUNTERPLAY_RESOLVED';   actionId: string; success: boolean; costSpent: number }

  // Economy
  | { type: 'MONTHLY_SETTLEMENT';     settlement: number; cashflow: number; mlMod: number }
  | { type: 'REGIME_CHANGED';         regime: MarketRegime }
  | { type: 'SHIELD_PROC';            cashSaved: number; shieldsRemaining: number }
  | { type: 'SHIELD_CONSUMED';        layerId: string }
  | { type: 'FREEZE_APPLIED';         ticks: number; source: string }

  // Sabotage / PvP
  | { type: 'SABOTAGE_RECEIVED';      sabotageId: string; kind: SabotageKind; sourceDisplayName: string; intensity: number }
  | { type: 'SABOTAGE_COUNTERED';     sabotageId: string; actionId: string }
  | { type: 'BATTLE_PHASE_CHANGED';   phase: BattlePhase }
  | { type: 'BATTLE_SCORE_UPDATE';    local: number; opponent: number }

  // Syndicate
  | { type: 'RESCUE_WINDOW_OPENED';   rescueeDisplayName: string; ticksRemaining: number }
  | { type: 'RESCUE_CONTRIBUTION';    amount: number }
  | { type: 'RESCUE_DISMISSED' }
  | { type: 'AID_SUBMITTED';          recipientId: string; aidType: string; amount: number }

  // Season / ML
  | { type: 'SEASON_PULSE';           xpGained: number; dominionDelta: number }
  | { type: 'INTELLIGENCE_UPDATE';    alphaDelta: number; riskDelta: number }

  // Telemetry
  | { type: 'TELEMETRY_EMIT';         telemetryType: string; payload: Record<string, number | string | boolean | null> }

  // Mechanic touch
  | { type: 'MECHANIC_TOUCHED';       mechanicId: string; signal: number };

// ── Types reused in events ────────────────────────────────────────────────────
export type RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

export type ForcedEventType =
  | 'FUBAR_HIT'
  | 'MISSED_WINDOW'
  | 'OBSTACLE_SPAWN'
  | 'SABOTAGE_INJECT'
  | 'LEGEND_PRESSURE'
  | 'ISOLATION_TAX'
  | 'BLEED_TICK';
