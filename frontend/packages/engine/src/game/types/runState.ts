// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/runState.ts
// Sprint 8 — Full Rebuild
//
// CHANGES FROM SPRINT 0:
//   ✦ RunScreen — added 'lobby' (LobbyScreen.tsx routes here pre-match)
//   ✦ MarketRegime — added 'Recession' and 'Recovery' (used in EmpireRuleEngine)
//   ✦ RunState — +15 fields: runId, freedomThreshold, bleedModeActive, bleedSeverity,
//     runPhase, pressureTier, tickTier, tensionScore, haterHeat, shieldLayers,
//     battleBudget, trustScore, defectionStep, ghostDelta, cordPreview
//   ✦ IntelligenceState — +3: biasScore, convergenceSignal, sessionMomentum
//   ✦ SeasonState — +4: cordAccumulator, legendBeatCount, bleedRunCount, totalRunsCompleted
//   ✦ ActiveSabotage — +3: sourceEngineId, isCascadeLinked, cordPenaltyPerTick
//   ✦ RescueWindow — +4: windowId, effectivenessMultiplier, autoFundAmount, linkedTeammateId
//   ✦ BattleState — imports BattlePhase from ./battlePhase (fixes TS2322)
//   ✦ BattlePhase local re-declaration REMOVED (was causing conflict with battlePhase.ts)
//   ✦ SabotageKind re-exported from ./battlePhase (was locally declared, now canonical)
//   ✦ ADD ShieldLayerSummary — compact shield state for RunState hot path
//   ✦ ADD PsycheMeterSummary — condensed psyche state for Predator RunState
//   ✦ ADD RivalryStateSummary — rivalry state for Predator RunState
//   ✦ ADD FREEDOM_THRESHOLD, BLEED_CASH_THRESHOLD, BATTLE_BUDGET_MAX,
//         TRUST_SCORE_INITIAL, HATER_HEAT_MAX constants
//   ✦ createInitialRunState — all 15 new fields properly initialized
//
// RULES:
//   ✦ BattlePhase imported from ./battlePhase — never re-declared here.
//   ✦ SabotageKind imported from ./battlePhase — never re-declared here.
//   ✦ GameMode imported from ./modes — never re-declared here.
//   ✦ GameCard imported from ./cards — never re-declared here.
//
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════

import type { GameMode }    from './modes';
import type { GameCard }    from './cards';
import type {
  BattlePhase,
  ExtractionActionType,
  RivalryTier,
}                           from './battlePhase';
export type { BattlePhase } from './battlePhase';   // re-export for consumers

// ── Screen Lifecycle ──────────────────────────────────────────────────────────
/**
 * The four possible screen states.
 * 'lobby' added Sprint 8 — LobbyScreen.tsx exists and routes here.
 */
export type RunScreen = 'landing' | 'lobby' | 'run' | 'result' | 'bankrupt';

// ── Market Regime ─────────────────────────────────────────────────────────────
/**
 * Active market regime. Drives card drop weight modifiers and income adjustments.
 * 'Recession' and 'Recovery' added Sprint 8 — used in EmpireRuleEngine.
 */
export type MarketRegime =
  | 'Stable'
  | 'Expansion'
  | 'Compression'
  | 'Panic'
  | 'Euphoria'
  | 'Recession'
  | 'Recovery';

// ── Sub-State Types ───────────────────────────────────────────────────────────

/**
 * Telemetry envelope — emitted at each tick for analytics + replay.
 * Batched in 50-event groups before flush (TELEMETRY_BATCH_SIZE).
 */
export type TelemetryEnvelopeV2 = {
  tick:    number;
  type:    string;
  payload: Record<string, number | string | boolean | null>;
};

/**
 * ML / alpha engine intelligence state.
 * Sprint 8: +biasScore, +convergenceSignal, +sessionMomentum
 */
export interface IntelligenceState {
  /** 0.0–1.0 — predictive power of current ML model for this run */
  alpha:               number;
  /** Aggregate risk score from hater heat + pressure + cascades */
  risk:                number;
  /** Market volatility signal (drives card effect variance) */
  volatility:          number;
  /** Anti-cheat confidence (1.0 = clean, 0 = flagged) */
  antiCheat:           number;
  /** How well current deck matches player's historical win patterns */
  personalization:     number;
  /** How well card recommendations fit current run context */
  rewardFit:           number;
  /** Active recommendation confidence score */
  recommendationPower: number;
  /** Risk of player quitting in next 30 ticks */
  churnRisk:           number;
  /** Current run momentum signal (positive = improving trajectory) */
  momentum:            number;
  /** Cognitive bias activation score (0 = unbiased, 1 = fully biased) */
  biasScore:           number;
  /** Convergence signal: how close player is to optimal play path */
  convergenceSignal:   number;
  /** Session-level momentum across all runs today */
  sessionMomentum:     number;
}

/**
 * Season / battle pass state.
 * Sprint 8: +cordAccumulator, +legendBeatCount, +bleedRunCount, +totalRunsCompleted
 */
export interface SeasonState {
  /** Season XP — earned each run based on cashflow and grade */
  xp:                  number;
  /** Current battle pass tier (1–100) */
  passTier:            number;
  /** Dominion control score (0–1000) — territory meta-game */
  dominionControl:     number;
  /** Active node pressure reading */
  nodePressure:        number;
  /** Consecutive win streak (resets on BANKRUPT or ABANDONED) */
  winStreak:           number;
  /** Battle pass progression level */
  battlePassLevel:     number;
  /** Pending unclaimed rewards */
  rewardsPending:      number;
  /** Accumulated CORD score this season (not normalized) */
  cordAccumulator:     number;
  /** Lifetime PHANTOM legends beaten */
  legendBeatCount:     number;
  /** Number of GO_ALONE Bleed Mode runs completed */
  bleedRunCount:       number;
  /** Total runs completed (all modes, all outcomes) */
  totalRunsCompleted:  number;
}

/**
 * An active sabotage applied by an opponent or hater bot.
 * Sprint 8: +sourceEngineId, +isCascadeLinked, +cordPenaltyPerTick
 */
export interface ActiveSabotage {
  id:                  string;
  kind:                ExtractionActionType;
  label:               string;
  severity:            'MINOR' | 'MAJOR' | 'CRITICAL';
  ticksRemaining:      number;
  sourceDisplayName:   string;
  impactValue:         number;
  /** Which engine injected this sabotage (battle, cascade, tension) */
  sourceEngineId:      string;
  /** True if this sabotage was triggered as part of a cascade chain */
  isCascadeLinked:     boolean;
  /** CORD score deducted per tick while this sabotage is active */
  cordPenaltyPerTick:  number;
}

/**
 * Syndicate rescue window — open contribution period for distressed teammate.
 * Sprint 8: +windowId, +effectivenessMultiplier, +autoFundAmount, +linkedTeammateId
 */
export interface RescueWindow {
  /** Unique window ID — matches rescueWindowEngine.RescueWindow.windowId */
  windowId:               string;
  rescueeDisplayName:     string;
  rescueeNetWorth:        number;
  ticksRemaining:         number;
  allianceName:           string;
  contributionRequired:   number;
  totalContributed:       number;
  /** Multiplier on rescue effectiveness based on timing (1.0–1.5) */
  effectivenessMultiplier: number;
  /** Amount treasury will auto-fund if no manual contribution */
  autoFundAmount:         number;
  /** Player ID of the teammate in distress */
  linkedTeammateId:       string;
}

// ── Shield Layer Summary ──────────────────────────────────────────────────────
/**
 * Compact shield layer state for RunState hot path.
 * Full ShieldLayer type lives in engines/shield/types.ts.
 * RunState carries this summary — components read engine for full detail.
 */
export interface ShieldLayerSummary {
  /** 'L1' | 'L2' | 'L3' | 'L4' (ShieldLayerId short form) */
  id:         string;
  label:      string;
  current:    number;
  max:        number;
  breached:   boolean;
}

// ── Psyche Meter Summary ──────────────────────────────────────────────────────
/**
 * Condensed psyche state embedded in RunState for HEAD_TO_HEAD mode.
 * Full PsycheMeterState lives in game/modes/predator/psycheMeter.ts.
 */
export interface PsycheMeterSummary {
  /** 0.0 (calm) → 1.0 (max tilt) */
  value:                  number;
  inTilt:                 boolean;
  tiltCount:              number;
  /** Accumulated CORD penalty from tilt ticks (0.001 per tilt tick) */
  cordPenaltyAccumulated: number;
}

// ── Rivalry State Summary ─────────────────────────────────────────────────────
/**
 * Active rivalry state for HEAD_TO_HEAD mode.
 * Full rivalry model lives in game/modes/predator/rivalryModel.ts.
 */
export interface RivalryStateSummary {
  /** Opponent player ID */
  rivalId:     string;
  tier:        RivalryTier;
  winStreak:   number;
  /** Heat bonus applied to all bot attacks due to rivalry */
  heatBonus:   number;
}

// ── Battle State ──────────────────────────────────────────────────────────────
/**
 * HEAD_TO_HEAD battle session state.
 * BattlePhase imported from ./battlePhase — NOT re-declared here.
 */
export interface BattleState {
  phase:  BattlePhase;
  score:  { local: number; opponent: number };
  round:  number;
}

// ── Core Run State ────────────────────────────────────────────────────────────
/**
 * The canonical run state owned by runReducer.
 * App.tsx reads this — it never writes directly.
 *
 * Sprint 8: +15 fields aligned to engine RunStateSnapshot.
 */
export interface RunState {
  // ── Identity ──────────────────────────────────────────────────────────
  /** UUID assigned at run start by EngineOrchestrator */
  runId:               string;
  mode:                GameMode;
  seed:                number;
  screen:              RunScreen;

  // ── Economy ───────────────────────────────────────────────────────────
  cash:                number;
  income:              number;
  expenses:            number;
  netWorth:            number;
  equityHistory:       number[];

  // ── Win Condition ─────────────────────────────────────────────────────
  /** Net worth required to achieve FREEDOM outcome */
  freedomThreshold:    number;

  // ── Progression ───────────────────────────────────────────────────────
  tick:                number;
  totalTicks:          number;
  freezeTicks:         number;
  shields:             number;
  shieldConsuming:     boolean;

  // ── Shield Layers ─────────────────────────────────────────────────────
  /** Compact L1–L4 shield summaries (full state lives in ShieldEngine) */
  shieldLayers:        ShieldLayerSummary[];

  // ── Cards ─────────────────────────────────────────────────────────────
  hand:                GameCard[];

  // ── Pressure & Tension ────────────────────────────────────────────────
  regime:              MarketRegime;
  /** Active pressure tier: CALM | BUILDING | ELEVATED | HIGH | CRITICAL */
  pressureTier:        string;
  /** Active tick tier: T0 | T1 | T2 | T3 | T4 */
  tickTier:            string;
  /** 0.0–1.0 tension score from TensionEngine */
  tensionScore:        number;

  // ── Adversary State ───────────────────────────────────────────────────
  haterSabotageCount:  number;
  /** Hater heat level (0–100) — drives bot attack frequency */
  haterHeat:           number;

  // ── Empire (GO_ALONE) specific ────────────────────────────────────────
  /** True when cash < income × bleedModeActivationRatio */
  bleedModeActive:     boolean;
  /** 'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL' */
  bleedSeverity:       string;
  /** Current run phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY' */
  runPhase:            string;

  // ── Predator (HEAD_TO_HEAD) specific ──────────────────────────────────
  /** Battle Budget remaining for current round (0 when not HEAD_TO_HEAD) */
  battleBudget:        number;
  /** Psyche meter summary (null when not HEAD_TO_HEAD) */
  psyche:              PsycheMeterSummary | null;
  /** Rivalry state (null when not HEAD_TO_HEAD) */
  rivalry:             RivalryStateSummary | null;

  // ── Syndicate (TEAM_UP) specific ──────────────────────────────────────
  /** Trust score 0.0–1.0 (0 when not TEAM_UP) */
  trustScore:          number;
  /** Current defection step ('NONE' | 'BREAK_PACT' | 'SILENT_EXIT' | 'ASSET_SEIZURE') */
  defectionStep:       string;

  // ── Phantom (CHASE_A_LEGEND) specific ─────────────────────────────────
  /** CORD delta vs legend (+positive = ahead, negative = behind) */
  ghostDelta:          number;

  // ── CORD Preview ──────────────────────────────────────────────────────
  /** Live CORD estimate updated every 5 ticks (null = not yet computed) */
  cordPreview:         number | null;

  // ── Context ───────────────────────────────────────────────────────────
  events:              string[];
  telemetry:           TelemetryEnvelopeV2[];

  // ── ML / Intelligence ─────────────────────────────────────────────────
  intelligence:        IntelligenceState;

  // ── Season ────────────────────────────────────────────────────────────
  season:              SeasonState;

  // ── Multiplayer overlays ───────────────────────────────────────────────
  activeSabotages:     ActiveSabotage[];
  rescueWindow:        RescueWindow | null;
  battleState:         BattleState;
}

// ── Starting State Constants ──────────────────────────────────────────────────
/** Cash balance at run start. */
export const STARTING_CASH          = 28_000;
/** Monthly income at run start. */
export const STARTING_INCOME        = 2_100;
/** Monthly expenses at run start. */
export const STARTING_EXPENSES      = 4_800;
/** Total run ticks at T1 pace (~12 minutes). */
export const RUN_TICKS              = 720;
/** Net worth required to achieve FREEDOM outcome. */
export const FREEDOM_THRESHOLD      = 500_000;
/** Cash threshold below which GO_ALONE Bleed Mode activates. */
export const BLEED_CASH_THRESHOLD   = 12_000;
/** Maximum battle budget per HEAD_TO_HEAD round. */
export const BATTLE_BUDGET_MAX      = 500;
/** Initial trust score for TEAM_UP mode (0.0–1.0). */
export const TRUST_SCORE_INITIAL    = 0.70;
/** Maximum hater heat level (drives bot attack frequency). */
export const HATER_HEAT_MAX         = 100;

// ── Starting State Factory ────────────────────────────────────────────────────
/**
 * Creates a fully initialized RunState for a new run.
 * All 15 Sprint 8 fields properly initialized.
 * Called by runReducer on 'RUN_START' event.
 */
export function createInitialRunState(mode: GameMode, seed: number): RunState {
  const runId = `run_${seed}_${Date.now()}`;
  return {
    // Identity
    runId,
    mode,
    seed,
    screen:       'run',

    // Economy
    cash:          STARTING_CASH,
    income:        STARTING_INCOME,
    expenses:      STARTING_EXPENSES,
    netWorth:      STARTING_CASH,
    equityHistory: [STARTING_CASH],

    // Win condition
    freedomThreshold: FREEDOM_THRESHOLD,

    // Progression
    tick:            0,
    totalTicks:      RUN_TICKS,
    freezeTicks:     0,
    shields:         0,
    shieldConsuming: false,

    // Shield layers — 4 layers initialized at full integrity
    shieldLayers: [
      { id: 'L1', label: 'LIQUIDITY BUFFER', current: 100, max: 100, breached: false },
      { id: 'L2', label: 'CREDIT LINE',      current: 80,  max: 80,  breached: false },
      { id: 'L3', label: 'ASSET FLOOR',      current: 60,  max: 60,  breached: false },
      { id: 'L4', label: 'NETWORK CORE',     current: 40,  max: 40,  breached: false },
    ],

    // Cards
    hand: [],

    // Pressure & Tension
    regime:       'Stable',
    pressureTier: 'CALM',
    tickTier:     'T1',
    tensionScore: 0,

    // Adversary
    haterSabotageCount: 0,
    haterHeat:          0,

    // Empire
    bleedModeActive: false,
    bleedSeverity:   'NONE',
    runPhase:        'FOUNDATION',

    // Predator
    battleBudget:    mode === 'HEAD_TO_HEAD' ? 200 : 0,
    psyche:          mode === 'HEAD_TO_HEAD' ? {
      value: 0, inTilt: false, tiltCount: 0, cordPenaltyAccumulated: 0,
    } : null,
    rivalry:         null,

    // Syndicate
    trustScore:      mode === 'TEAM_UP' ? TRUST_SCORE_INITIAL : 0,
    defectionStep:   'NONE',

    // Phantom
    ghostDelta:      0,

    // CORD Preview
    cordPreview:     null,

    // Context
    events:    [`🎮 Run started (seed=${seed}). Mode: ${mode}`],
    telemetry: [],

    // Intelligence
    intelligence: {
      alpha:              0.45,
      risk:               0.35,
      volatility:         0.30,
      antiCheat:          0.50,
      personalization:    0.40,
      rewardFit:          0.45,
      recommendationPower:0.42,
      churnRisk:          0.28,
      momentum:           0.33,
      biasScore:          0.15,
      convergenceSignal:  0.50,
      sessionMomentum:    0.40,
    },

    // Season
    season: {
      xp:                 0,
      passTier:           1,
      dominionControl:    0,
      nodePressure:       0,
      winStreak:          0,
      battlePassLevel:    1,
      rewardsPending:     0,
      cordAccumulator:    0,
      legendBeatCount:    0,
      bleedRunCount:      0,
      totalRunsCompleted: 0,
    },

    // Multiplayer overlays
    activeSabotages: [],
    rescueWindow:    null,
    battleState: {
      phase: 'IDLE',
      score: { local: 0, opponent: 0 },
      round: 1,
    },
  };
}
