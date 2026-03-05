"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HATER_HEAT_MAX = exports.TRUST_SCORE_INITIAL = exports.BATTLE_BUDGET_MAX = exports.BLEED_CASH_THRESHOLD = exports.FREEDOM_THRESHOLD = exports.RUN_TICKS = exports.STARTING_EXPENSES = exports.STARTING_INCOME = exports.STARTING_CASH = void 0;
exports.createInitialRunState = createInitialRunState;
// ── Starting State Constants ──────────────────────────────────────────────────
/** Cash balance at run start. */
exports.STARTING_CASH = 28_000;
/** Monthly income at run start. */
exports.STARTING_INCOME = 2_100;
/** Monthly expenses at run start. */
exports.STARTING_EXPENSES = 4_800;
/** Total run ticks at T1 pace (~12 minutes). */
exports.RUN_TICKS = 720;
/** Net worth required to achieve FREEDOM outcome. */
exports.FREEDOM_THRESHOLD = 500_000;
/** Cash threshold below which GO_ALONE Bleed Mode activates. */
exports.BLEED_CASH_THRESHOLD = 12_000;
/** Maximum battle budget per HEAD_TO_HEAD round. */
exports.BATTLE_BUDGET_MAX = 500;
/** Initial trust score for TEAM_UP mode (0.0–1.0). */
exports.TRUST_SCORE_INITIAL = 0.70;
/** Maximum hater heat level (drives bot attack frequency). */
exports.HATER_HEAT_MAX = 100;
// ── Starting State Factory ────────────────────────────────────────────────────
/**
 * Creates a fully initialized RunState for a new run.
 * All 15 Sprint 8 fields properly initialized.
 * Called by runReducer on 'RUN_START' event.
 */
function createInitialRunState(mode, seed) {
    const runId = `run_${seed}_${Date.now()}`;
    return {
        // Identity
        runId,
        mode,
        seed,
        screen: 'run',
        // Economy
        cash: exports.STARTING_CASH,
        income: exports.STARTING_INCOME,
        expenses: exports.STARTING_EXPENSES,
        netWorth: exports.STARTING_CASH,
        equityHistory: [exports.STARTING_CASH],
        // Win condition
        freedomThreshold: exports.FREEDOM_THRESHOLD,
        // Progression
        tick: 0,
        totalTicks: exports.RUN_TICKS,
        freezeTicks: 0,
        shields: 0,
        shieldConsuming: false,
        // Shield layers — 4 layers initialized at full integrity
        shieldLayers: [
            { id: 'L1', label: 'LIQUIDITY BUFFER', current: 100, max: 100, breached: false },
            { id: 'L2', label: 'CREDIT LINE', current: 80, max: 80, breached: false },
            { id: 'L3', label: 'ASSET FLOOR', current: 60, max: 60, breached: false },
            { id: 'L4', label: 'NETWORK CORE', current: 40, max: 40, breached: false },
        ],
        // Cards
        hand: [],
        // Pressure & Tension
        regime: 'Stable',
        pressureTier: 'CALM',
        tickTier: 'T1',
        tensionScore: 0,
        // Adversary
        haterSabotageCount: 0,
        haterHeat: 0,
        // Empire
        bleedModeActive: false,
        bleedSeverity: 'NONE',
        runPhase: 'FOUNDATION',
        // Predator
        battleBudget: mode === 'HEAD_TO_HEAD' ? 200 : 0,
        psyche: mode === 'HEAD_TO_HEAD' ? {
            value: 0, inTilt: false, tiltCount: 0, cordPenaltyAccumulated: 0,
        } : null,
        rivalry: null,
        // Syndicate
        trustScore: mode === 'TEAM_UP' ? exports.TRUST_SCORE_INITIAL : 0,
        defectionStep: 'NONE',
        // Phantom
        ghostDelta: 0,
        // CORD Preview
        cordPreview: null,
        // Context
        events: [`🎮 Run started (seed=${seed}). Mode: ${mode}`],
        telemetry: [],
        // Intelligence
        intelligence: {
            alpha: 0.45,
            risk: 0.35,
            volatility: 0.30,
            antiCheat: 0.50,
            personalization: 0.40,
            rewardFit: 0.45,
            recommendationPower: 0.42,
            churnRisk: 0.28,
            momentum: 0.33,
            biasScore: 0.15,
            convergenceSignal: 0.50,
            sessionMomentum: 0.40,
        },
        // Season
        season: {
            xp: 0,
            passTier: 1,
            dominionControl: 0,
            nodePressure: 0,
            winStreak: 0,
            battlePassLevel: 1,
            rewardsPending: 0,
            cordAccumulator: 0,
            legendBeatCount: 0,
            bleedRunCount: 0,
            totalRunsCompleted: 0,
        },
        // Multiplayer overlays
        activeSabotages: [],
        rescueWindow: null,
        battleState: {
            phase: 'IDLE',
            score: { local: 0, opponent: 0 },
            round: 1,
        },
    };
}
//# sourceMappingURL=runState.js.map