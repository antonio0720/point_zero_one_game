// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/battlePhase.ts
// Sprint 8 — Canonical battle types (shared source of truth)
//
// CHANGES FROM SPRINT 8 INITIAL:
//   ✦ ADD ExtractionActionType enum (was SabotageKind in runState.ts — wrong home)
//   ✦ ADD CounterplayResult type
//   ✦ ADD RivalryTier enum (from rivalryModel.ts — now in types layer)
//   ✦ ADD BattleRoundResult interface
//   ✦ ADD SpectatorFeed interface (HEAD_TO_HEAD spectator mode)
//
// PROBLEM FIXED:
//   runState.ts and BattleHUD.tsx both defined BattlePhase locally.
//   runState.ts included 'COMPLETE'; BattleHUD did not → TS2322 errors.
//   Both now import from here. runState.ts no longer declares it locally.
//   BattleHUD.tsx updated to import this type.
//
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════

// ── Battle Phase ──────────────────────────────────────────────────────────────
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
export type BattlePhase =
  | 'IDLE'
  | 'PREP'
  | 'ACTIVE'
  | 'COUNTERPLAY'
  | 'RESOLUTION'
  | 'COMPLETE';

export const BATTLE_PHASE_LABELS: Record<BattlePhase, string> = {
  IDLE:         'Standby',
  PREP:         'Preparing',
  ACTIVE:       'Combat Active',
  COUNTERPLAY:  'Counterplay Window',
  RESOLUTION:   'Resolving',
  COMPLETE:     'Complete',
} as const;

/** Color for each battle phase indicator (WCAG AA+ on #0D0D1E). */
export const BATTLE_PHASE_COLORS: Record<BattlePhase, string> = {
  IDLE:         '#6A6A90',  // textDim — not active
  PREP:         '#B8B8D8',  // textSub — loading
  ACTIVE:       '#2EE89A',  // green — live combat
  COUNTERPLAY:  '#FF9B2F',  // orange — time-sensitive
  RESOLUTION:   '#9B7DFF',  // purple — computing
  COMPLETE:     '#C9A84C',  // gold — concluded
} as const;

// ── Extraction Action Type ─────────────────────────────────────────────────────
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
export type ExtractionActionType =
  | 'INCOME_DRAIN'
  | 'CARD_BLOCK'
  | 'CASH_SIPHON'
  | 'SHIELD_CRACK'
  | 'DEBT_SPIKE'
  | 'HEAT_SPIKE';

/** @deprecated Use ExtractionActionType. Alias for backward compat with runState.ts consumers. */
export type SabotageKind = ExtractionActionType;

export const EXTRACTION_ACTION_LABELS: Record<ExtractionActionType, string> = {
  INCOME_DRAIN: 'Income Drain',
  CARD_BLOCK:   'Card Block',
  CASH_SIPHON:  'Cash Siphon',
  SHIELD_CRACK: 'Shield Crack',
  DEBT_SPIKE:   'Debt Spike',
  HEAT_SPIKE:   'Heat Spike',
} as const;

/** Battle Budget cost per extraction action type. */
export const EXTRACTION_BB_COSTS: Record<ExtractionActionType, number> = {
  INCOME_DRAIN: 3,
  CARD_BLOCK:   4,
  CASH_SIPHON:  5,
  SHIELD_CRACK: 4,
  DEBT_SPIKE:   3,
  HEAT_SPIKE:   2,
} as const;

// ── Counterplay Result ─────────────────────────────────────────────────────────
/**
 * The four possible outcomes of a counterplay window response.
 *
 * SUCCESS        — Counter card played in time; extraction fully blocked
 * PARTIAL        — Partial counter; extraction lands at reduced effectiveness
 * FAILED         — Counter card played but opponent's card was stronger
 * MISSED_WINDOW  — Window expired before player responded; worst outcome
 * DECLINED       — Player chose not to counter (intentional or strategic)
 */
export type CounterplayResult =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'FAILED'
  | 'MISSED_WINDOW'
  | 'DECLINED';

export const COUNTERPLAY_RESULT_LABELS: Record<CounterplayResult, string> = {
  SUCCESS:       'Blocked',
  PARTIAL:       'Partial Block',
  FAILED:        'Counter Failed',
  MISSED_WINDOW: 'Window Expired',
  DECLINED:      'Declined',
} as const;

// ── Rivalry Tier ──────────────────────────────────────────────────────────────
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
export type RivalryTier =
  | 'STRANGERS'
  | 'RIVALS'
  | 'ARCH_RIVALS'
  | 'NEMESIS'
  | 'LEGEND_RIVALS';

export const RIVALRY_TIER_LABELS: Record<RivalryTier, string> = {
  STRANGERS:     'Strangers',
  RIVALS:        'Rivals',
  ARCH_RIVALS:   'Arch-Rivals',
  NEMESIS:       'Nemesis',
  LEGEND_RIVALS: 'Legend Rivals',
} as const;

/** Minimum match count to enter each rivalry tier. */
export const RIVALRY_TIER_MATCH_THRESHOLDS: Record<RivalryTier, number> = {
  STRANGERS:     0,
  RIVALS:        3,
  ARCH_RIVALS:   10,
  NEMESIS:       20,
  LEGEND_RIVALS: 50,
} as const;

/** Color per rivalry tier (WCAG AA+ on #0D0D1E). */
export const RIVALRY_TIER_COLORS: Record<RivalryTier, string> = {
  STRANGERS:     '#6A6A90',  // textDim
  RIVALS:        '#B8B8D8',  // textSub
  ARCH_RIVALS:   '#FF9B2F',  // orange
  NEMESIS:       '#FF4D4D',  // red
  LEGEND_RIVALS: '#9B7DFF',  // purple
} as const;

// ── Battle Round Result ────────────────────────────────────────────────────────
/**
 * Scored result of a single HEAD_TO_HEAD battle round.
 * Produced by BattleEngine.resolveRound() and stored in BattleState.
 */
export interface BattleRoundResult {
  round:                number;
  winnerId:             string;       // player ID of round winner
  loserId:              string;
  localNetWorthDelta:   number;       // net worth change to local player this round
  opponentNetWorthDelta:number;
  extractionsFired:     number;       // total extractions fired by both players
  countersSucceeded:    number;       // total successful counterplays
  battleBudgetSpent: {
    local:    number;
    opponent: number;
  };
  shieldDamageDealt: {
    local:    number;
    opponent: number;
  };
  winCondition: 'NET_WORTH_LEAD' | 'OPPONENT_BANKRUPT' | 'TIMEOUT' | 'FORFEIT';
}

// ── Spectator Feed Entry ───────────────────────────────────────────────────────
/**
 * Real-time event visible to HEAD_TO_HEAD spectators.
 * Spectators see delayed data — these events are queued with a 1-tick delay.
 */
export interface SpectatorFeedEntry {
  tick:        number;
  type:
    | 'EXTRACTION_FIRED'
    | 'COUNTERPLAY_RESOLVED'
    | 'SHIELD_DAMAGED'
    | 'CARD_PLAYED'
    | 'PHASE_CHANGED'
    | 'CORD_PROJECTION_UPDATE';
  actorId:     string;   // which player this event belongs to
  label:       string;   // display string (e.g. "⚔️ CASH SIPHON → $4,200")
  cordDelta:   number;   // estimated CORD impact of this event
}
