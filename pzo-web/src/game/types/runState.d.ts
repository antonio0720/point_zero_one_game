import type { GameMode } from './modes';
import type { GameCard } from './cards';
import type { BattlePhase, ExtractionActionType, RivalryTier } from './battlePhase';
export type { BattlePhase } from './battlePhase';
/**
 * The four possible screen states.
 * 'lobby' added Sprint 8 — LobbyScreen.tsx exists and routes here.
 */
export type RunScreen = 'landing' | 'lobby' | 'run' | 'result' | 'bankrupt';
/**
 * Active market regime. Drives card drop weight modifiers and income adjustments.
 * 'Recession' and 'Recovery' added Sprint 8 — used in EmpireRuleEngine.
 */
export type MarketRegime = 'Stable' | 'Expansion' | 'Compression' | 'Panic' | 'Euphoria' | 'Recession' | 'Recovery';
/**
 * Telemetry envelope — emitted at each tick for analytics + replay.
 * Batched in 50-event groups before flush (TELEMETRY_BATCH_SIZE).
 */
export type TelemetryEnvelopeV2 = {
    tick: number;
    type: string;
    payload: Record<string, number | string | boolean | null>;
};
/**
 * ML / alpha engine intelligence state.
 * Sprint 8: +biasScore, +convergenceSignal, +sessionMomentum
 */
export interface IntelligenceState {
    /** 0.0–1.0 — predictive power of current ML model for this run */
    alpha: number;
    /** Aggregate risk score from hater heat + pressure + cascades */
    risk: number;
    /** Market volatility signal (drives card effect variance) */
    volatility: number;
    /** Anti-cheat confidence (1.0 = clean, 0 = flagged) */
    antiCheat: number;
    /** How well current deck matches player's historical win patterns */
    personalization: number;
    /** How well card recommendations fit current run context */
    rewardFit: number;
    /** Active recommendation confidence score */
    recommendationPower: number;
    /** Risk of player quitting in next 30 ticks */
    churnRisk: number;
    /** Current run momentum signal (positive = improving trajectory) */
    momentum: number;
    /** Cognitive bias activation score (0 = unbiased, 1 = fully biased) */
    biasScore: number;
    /** Convergence signal: how close player is to optimal play path */
    convergenceSignal: number;
    /** Session-level momentum across all runs today */
    sessionMomentum: number;
}
/**
 * Season / battle pass state.
 * Sprint 8: +cordAccumulator, +legendBeatCount, +bleedRunCount, +totalRunsCompleted
 */
export interface SeasonState {
    /** Season XP — earned each run based on cashflow and grade */
    xp: number;
    /** Current battle pass tier (1–100) */
    passTier: number;
    /** Dominion control score (0–1000) — territory meta-game */
    dominionControl: number;
    /** Active node pressure reading */
    nodePressure: number;
    /** Consecutive win streak (resets on BANKRUPT or ABANDONED) */
    winStreak: number;
    /** Battle pass progression level */
    battlePassLevel: number;
    /** Pending unclaimed rewards */
    rewardsPending: number;
    /** Accumulated CORD score this season (not normalized) */
    cordAccumulator: number;
    /** Lifetime PHANTOM legends beaten */
    legendBeatCount: number;
    /** Number of GO_ALONE Bleed Mode runs completed */
    bleedRunCount: number;
    /** Total runs completed (all modes, all outcomes) */
    totalRunsCompleted: number;
}
/**
 * An active sabotage applied by an opponent or hater bot.
 * Sprint 8: +sourceEngineId, +isCascadeLinked, +cordPenaltyPerTick
 */
export interface ActiveSabotage {
    id: string;
    kind: ExtractionActionType;
    label: string;
    severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
    ticksRemaining: number;
    sourceDisplayName: string;
    impactValue: number;
    /** Which engine injected this sabotage (battle, cascade, tension) */
    sourceEngineId: string;
    /** True if this sabotage was triggered as part of a cascade chain */
    isCascadeLinked: boolean;
    /** CORD score deducted per tick while this sabotage is active */
    cordPenaltyPerTick: number;
}
/**
 * Syndicate rescue window — open contribution period for distressed teammate.
 * Sprint 8: +windowId, +effectivenessMultiplier, +autoFundAmount, +linkedTeammateId
 */
export interface RescueWindow {
    /** Unique window ID — matches rescueWindowEngine.RescueWindow.windowId */
    windowId: string;
    rescueeDisplayName: string;
    rescueeNetWorth: number;
    ticksRemaining: number;
    allianceName: string;
    contributionRequired: number;
    totalContributed: number;
    /** Multiplier on rescue effectiveness based on timing (1.0–1.5) */
    effectivenessMultiplier: number;
    /** Amount treasury will auto-fund if no manual contribution */
    autoFundAmount: number;
    /** Player ID of the teammate in distress */
    linkedTeammateId: string;
}
/**
 * Compact shield layer state for RunState hot path.
 * Full ShieldLayer type lives in engines/shield/types.ts.
 * RunState carries this summary — components read engine for full detail.
 */
export interface ShieldLayerSummary {
    /** 'L1' | 'L2' | 'L3' | 'L4' (ShieldLayerId short form) */
    id: string;
    label: string;
    current: number;
    max: number;
    breached: boolean;
}
/**
 * Condensed psyche state embedded in RunState for HEAD_TO_HEAD mode.
 * Full PsycheMeterState lives in game/modes/predator/psycheMeter.ts.
 */
export interface PsycheMeterSummary {
    /** 0.0 (calm) → 1.0 (max tilt) */
    value: number;
    inTilt: boolean;
    tiltCount: number;
    /** Accumulated CORD penalty from tilt ticks (0.001 per tilt tick) */
    cordPenaltyAccumulated: number;
}
/**
 * Active rivalry state for HEAD_TO_HEAD mode.
 * Full rivalry model lives in game/modes/predator/rivalryModel.ts.
 */
export interface RivalryStateSummary {
    /** Opponent player ID */
    rivalId: string;
    tier: RivalryTier;
    winStreak: number;
    /** Heat bonus applied to all bot attacks due to rivalry */
    heatBonus: number;
}
/**
 * HEAD_TO_HEAD battle session state.
 * BattlePhase imported from ./battlePhase — NOT re-declared here.
 */
export interface BattleState {
    phase: BattlePhase;
    score: {
        local: number;
        opponent: number;
    };
    round: number;
}
/**
 * The canonical run state owned by runReducer.
 * App.tsx reads this — it never writes directly.
 *
 * Sprint 8: +15 fields aligned to engine RunStateSnapshot.
 */
export interface RunState {
    /** UUID assigned at run start by EngineOrchestrator */
    runId: string;
    mode: GameMode;
    seed: number;
    screen: RunScreen;
    cash: number;
    income: number;
    expenses: number;
    netWorth: number;
    equityHistory: number[];
    /** Net worth required to achieve FREEDOM outcome */
    freedomThreshold: number;
    tick: number;
    totalTicks: number;
    freezeTicks: number;
    shields: number;
    shieldConsuming: boolean;
    /** Compact L1–L4 shield summaries (full state lives in ShieldEngine) */
    shieldLayers: ShieldLayerSummary[];
    hand: GameCard[];
    regime: MarketRegime;
    /** Active pressure tier: CALM | BUILDING | ELEVATED | HIGH | CRITICAL */
    pressureTier: string;
    /** Active tick tier: T0 | T1 | T2 | T3 | T4 */
    tickTier: string;
    /** 0.0–1.0 tension score from TensionEngine */
    tensionScore: number;
    haterSabotageCount: number;
    /** Hater heat level (0–100) — drives bot attack frequency */
    haterHeat: number;
    /** True when cash < income × bleedModeActivationRatio */
    bleedModeActive: boolean;
    /** 'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL' */
    bleedSeverity: string;
    /** Current run phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY' */
    runPhase: string;
    /** Battle Budget remaining for current round (0 when not HEAD_TO_HEAD) */
    battleBudget: number;
    /** Psyche meter summary (null when not HEAD_TO_HEAD) */
    psyche: PsycheMeterSummary | null;
    /** Rivalry state (null when not HEAD_TO_HEAD) */
    rivalry: RivalryStateSummary | null;
    /** Trust score 0.0–1.0 (0 when not TEAM_UP) */
    trustScore: number;
    /** Current defection step ('NONE' | 'BREAK_PACT' | 'SILENT_EXIT' | 'ASSET_SEIZURE') */
    defectionStep: string;
    /** CORD delta vs legend (+positive = ahead, negative = behind) */
    ghostDelta: number;
    /** Live CORD estimate updated every 5 ticks (null = not yet computed) */
    cordPreview: number | null;
    events: string[];
    telemetry: TelemetryEnvelopeV2[];
    intelligence: IntelligenceState;
    season: SeasonState;
    activeSabotages: ActiveSabotage[];
    rescueWindow: RescueWindow | null;
    battleState: BattleState;
}
/** Cash balance at run start. */
export declare const STARTING_CASH = 28000;
/** Monthly income at run start. */
export declare const STARTING_INCOME = 2100;
/** Monthly expenses at run start. */
export declare const STARTING_EXPENSES = 4800;
/** Total run ticks at T1 pace (~12 minutes). */
export declare const RUN_TICKS = 720;
/** Net worth required to achieve FREEDOM outcome. */
export declare const FREEDOM_THRESHOLD = 500000;
/** Cash threshold below which GO_ALONE Bleed Mode activates. */
export declare const BLEED_CASH_THRESHOLD = 12000;
/** Maximum battle budget per HEAD_TO_HEAD round. */
export declare const BATTLE_BUDGET_MAX = 500;
/** Initial trust score for TEAM_UP mode (0.0–1.0). */
export declare const TRUST_SCORE_INITIAL = 0.7;
/** Maximum hater heat level (drives bot attack frequency). */
export declare const HATER_HEAT_MAX = 100;
/**
 * Creates a fully initialized RunState for a new run.
 * All 15 Sprint 8 fields properly initialized.
 * Called by runReducer on 'RUN_START' event.
 */
export declare function createInitialRunState(mode: GameMode, seed: number): RunState;
//# sourceMappingURL=runState.d.ts.map