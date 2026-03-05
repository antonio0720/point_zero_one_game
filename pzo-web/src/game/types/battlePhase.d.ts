/**
 * State machine for a single HEAD_TO_HEAD battle session.
 *
 * IDLE          — No battle active (pre-run or between rounds)
 * PREP          — Run started, loading player state, not yet ticking
 * ACTIVE        — Both players in-run, extraction windows can open
 * COUNTERPLAY   — Extraction fired; defender has 5-second counter window
 * RESOLUTION    — Round scoring underway; no new actions accepted
 * COMPLETE      — Match concluded; sovereignty pipeline fires
 */
export type BattlePhase = 'IDLE' | 'PREP' | 'ACTIVE' | 'COUNTERPLAY' | 'RESOLUTION' | 'COMPLETE';
export declare const BATTLE_PHASE_LABELS: Record<BattlePhase, string>;
/** Color for each battle phase indicator (WCAG AA+ on #0D0D1E). */
export declare const BATTLE_PHASE_COLORS: Record<BattlePhase, string>;
/**
 * The six extraction action types in HEAD_TO_HEAD mode.
 * Each maps to a specific economic attack vector fired against the opponent.
 * Canonical home: battlePhase.ts (was SabotageKind in runState.ts — incorrect).
 *
 * INCOME_DRAIN    — Reduces opponent's monthly income for N ticks
 * CARD_BLOCK      — Locks a specific card type from opponent's hand
 * CASH_SIPHON     — Directly removes cash from opponent's balance
 * SHIELD_CRACK    — Deals integrity damage to opponent's targeted shield layer
 * DEBT_SPIKE      — Forces DEBT card into opponent's hand + expense spike
 * HEAT_SPIKE      — Increases all opponent's hater bot heat levels by X
 */
export type ExtractionActionType = 'INCOME_DRAIN' | 'CARD_BLOCK' | 'CASH_SIPHON' | 'SHIELD_CRACK' | 'DEBT_SPIKE' | 'HEAT_SPIKE';
/** @deprecated Use ExtractionActionType. Alias for backward compat with runState.ts consumers. */
export type SabotageKind = ExtractionActionType;
export declare const EXTRACTION_ACTION_LABELS: Record<ExtractionActionType, string>;
/** Battle Budget cost per extraction action type. */
export declare const EXTRACTION_BB_COSTS: Record<ExtractionActionType, number>;
/**
 * The four possible outcomes of a counterplay window response.
 *
 * SUCCESS        — Counter card played in time; extraction fully blocked
 * PARTIAL        — Partial counter; extraction lands at reduced effectiveness
 * FAILED         — Counter card played but opponent's card was stronger
 * MISSED_WINDOW  — Window expired before player responded; worst outcome
 * DECLINED       — Player chose not to counter (intentional or strategic)
 */
export type CounterplayResult = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'MISSED_WINDOW' | 'DECLINED';
export declare const COUNTERPLAY_RESULT_LABELS: Record<CounterplayResult, string>;
/**
 * Rivalry tiers — escalate as the same two players accumulate head-to-head history.
 * Tier transitions grant permanent mechanical consequences in all future matches.
 *
 * STRANGERS      — 0–2 matches. No rivalry mechanics active.
 * RIVALS         — 3+ matches. Rivalry badge created. +5 hater heat on win.
 * ARCH_RIVALS    — 10+ matches. Extraction actions cost 20% less BB.
 * NEMESIS        — 20+ matches. One Legendary extraction unlocked exclusively.
 * LEGEND_RIVALS  — 50+ matches. Run broadcast on leaderboard feed on match start.
 */
export type RivalryTier = 'STRANGERS' | 'RIVALS' | 'ARCH_RIVALS' | 'NEMESIS' | 'LEGEND_RIVALS';
export declare const RIVALRY_TIER_LABELS: Record<RivalryTier, string>;
/** Minimum match count to enter each rivalry tier. */
export declare const RIVALRY_TIER_MATCH_THRESHOLDS: Record<RivalryTier, number>;
/** Color per rivalry tier (WCAG AA+ on #0D0D1E). */
export declare const RIVALRY_TIER_COLORS: Record<RivalryTier, string>;
/**
 * Scored result of a single HEAD_TO_HEAD battle round.
 * Produced by BattleEngine.resolveRound() and stored in BattleState.
 */
export interface BattleRoundResult {
    round: number;
    winnerId: string;
    loserId: string;
    localNetWorthDelta: number;
    opponentNetWorthDelta: number;
    extractionsFired: number;
    countersSucceeded: number;
    battleBudgetSpent: {
        local: number;
        opponent: number;
    };
    shieldDamageDealt: {
        local: number;
        opponent: number;
    };
    winCondition: 'NET_WORTH_LEAD' | 'OPPONENT_BANKRUPT' | 'TIMEOUT' | 'FORFEIT';
}
/**
 * Real-time event visible to HEAD_TO_HEAD spectators.
 * Spectators see delayed data — these events are queued with a 1-tick delay.
 */
export interface SpectatorFeedEntry {
    tick: number;
    type: 'EXTRACTION_FIRED' | 'COUNTERPLAY_RESOLVED' | 'SHIELD_DAMAGED' | 'CARD_PLAYED' | 'PHASE_CHANGED' | 'CORD_PROJECTION_UPDATE';
    actorId: string;
    label: string;
    cordDelta: number;
}
//# sourceMappingURL=battlePhase.d.ts.map