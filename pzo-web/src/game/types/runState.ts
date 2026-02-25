// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/runState.ts
// Sprint 0: Run State Type Contracts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import type { GameMode } from './modes';
import type { GameCard } from './cards';

// ── Screen Lifecycle ──────────────────────────────────────────────────────────
export type RunScreen = 'landing' | 'run' | 'result' | 'bankrupt';

// ── Market Regime ─────────────────────────────────────────────────────────────
export type MarketRegime = 'Stable' | 'Expansion' | 'Compression' | 'Panic' | 'Euphoria';

// ── Core Run State ────────────────────────────────────────────────────────────
/** The canonical run state owned by runReducer. App.tsx reads this — it never writes it directly. */
export interface RunState {
  // Identity
  mode: GameMode;
  seed: number;
  screen: RunScreen;

  // Economy
  cash: number;
  income: number;
  expenses: number;
  netWorth: number;
  equityHistory: number[];

  // Progression
  tick: number;
  totalTicks: number;
  freezeTicks: number;
  shields: number;
  shieldConsuming: boolean;

  // Cards
  hand: GameCard[];

  // Context
  regime: MarketRegime;
  haterSabotageCount: number;

  // Telemetry
  events: string[];
  telemetry: TelemetryEnvelopeV2[];

  // ML / Intelligence
  intelligence: IntelligenceState;

  // Season
  season: SeasonState;

  // Multiplayer overlays
  activeSabotages: ActiveSabotage[];
  rescueWindow: RescueWindow | null;
  battleState: BattleState;
}

// ── Sub-State Types ───────────────────────────────────────────────────────────
export type TelemetryEnvelopeV2 = {
  tick: number;
  type: string;
  payload: Record<string, number | string | boolean | null>;
};

export interface IntelligenceState {
  alpha: number;
  risk: number;
  volatility: number;
  antiCheat: number;
  personalization: number;
  rewardFit: number;
  recommendationPower: number;
  churnRisk: number;
  momentum: number;
}

export interface SeasonState {
  xp: number;
  passTier: number;
  dominionControl: number;
  nodePressure: number;
  winStreak: number;
  battlePassLevel: number;
  rewardsPending: number;
}

export interface ActiveSabotage {
  id: string;
  kind: SabotageKind;
  label: string;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  ticksRemaining: number;
  sourceDisplayName: string;
  impactValue: number;
}

export type SabotageKind = 'INCOME_DRAIN' | 'CARD_BLOCK' | 'CASH_SIPHON' | 'SHIELD_CRACK' | 'DEBT_SPIKE' | 'HEAT_SPIKE';

export interface RescueWindow {
  rescueeDisplayName: string;
  rescueeNetWorth: number;
  ticksRemaining: number;
  allianceName: string;
  contributionRequired: number;
  totalContributed: number;
}

export interface BattleState {
  phase: BattlePhase;
  score: { local: number; opponent: number };
  round: number;
}

export type BattlePhase = 'PREP' | 'ACTIVE' | 'RESOLUTION' | 'COMPLETE';

// ── Starting State Factory ────────────────────────────────────────────────────
export const STARTING_CASH     = 28_000;
export const STARTING_INCOME   = 2_100;
export const STARTING_EXPENSES = 4_800;
export const RUN_TICKS         = 720;

export function createInitialRunState(mode: GameMode, seed: number): RunState {
  return {
    mode, seed,
    screen:     'run',
    cash:       STARTING_CASH,
    income:     STARTING_INCOME,
    expenses:   STARTING_EXPENSES,
    netWorth:   STARTING_CASH,
    equityHistory: [STARTING_CASH],
    tick:       0,
    totalTicks: RUN_TICKS,
    freezeTicks: 0,
    shields:    0,
    shieldConsuming: false,
    hand:       [],
    regime:     'Stable',
    haterSabotageCount: 0,
    events:     [],
    telemetry:  [],
    intelligence: {
      alpha: 0.45, risk: 0.35, volatility: 0.30, antiCheat: 0.50,
      personalization: 0.40, rewardFit: 0.45, recommendationPower: 0.42,
      churnRisk: 0.28, momentum: 0.33,
    },
    season: {
      xp: 0, passTier: 1, dominionControl: 0, nodePressure: 0,
      winStreak: 0, battlePassLevel: 1, rewardsPending: 0,
    },
    activeSabotages: [],
    rescueWindow: null,
    battleState: { phase: 'PREP', score: { local: 0, opponent: 0 }, round: 1 },
  };
}
