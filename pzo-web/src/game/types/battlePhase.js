"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RIVALRY_TIER_COLORS = exports.RIVALRY_TIER_MATCH_THRESHOLDS = exports.RIVALRY_TIER_LABELS = exports.COUNTERPLAY_RESULT_LABELS = exports.EXTRACTION_BB_COSTS = exports.EXTRACTION_ACTION_LABELS = exports.BATTLE_PHASE_COLORS = exports.BATTLE_PHASE_LABELS = void 0;
exports.BATTLE_PHASE_LABELS = {
    IDLE: 'Standby',
    PREP: 'Preparing',
    ACTIVE: 'Combat Active',
    COUNTERPLAY: 'Counterplay Window',
    RESOLUTION: 'Resolving',
    COMPLETE: 'Complete',
};
/** Color for each battle phase indicator (WCAG AA+ on #0D0D1E). */
exports.BATTLE_PHASE_COLORS = {
    IDLE: '#6A6A90', // textDim — not active
    PREP: '#B8B8D8', // textSub — loading
    ACTIVE: '#2EE89A', // green — live combat
    COUNTERPLAY: '#FF9B2F', // orange — time-sensitive
    RESOLUTION: '#9B7DFF', // purple — computing
    COMPLETE: '#C9A84C', // gold — concluded
};
exports.EXTRACTION_ACTION_LABELS = {
    INCOME_DRAIN: 'Income Drain',
    CARD_BLOCK: 'Card Block',
    CASH_SIPHON: 'Cash Siphon',
    SHIELD_CRACK: 'Shield Crack',
    DEBT_SPIKE: 'Debt Spike',
    HEAT_SPIKE: 'Heat Spike',
};
/** Battle Budget cost per extraction action type. */
exports.EXTRACTION_BB_COSTS = {
    INCOME_DRAIN: 3,
    CARD_BLOCK: 4,
    CASH_SIPHON: 5,
    SHIELD_CRACK: 4,
    DEBT_SPIKE: 3,
    HEAT_SPIKE: 2,
};
exports.COUNTERPLAY_RESULT_LABELS = {
    SUCCESS: 'Blocked',
    PARTIAL: 'Partial Block',
    FAILED: 'Counter Failed',
    MISSED_WINDOW: 'Window Expired',
    DECLINED: 'Declined',
};
exports.RIVALRY_TIER_LABELS = {
    STRANGERS: 'Strangers',
    RIVALS: 'Rivals',
    ARCH_RIVALS: 'Arch-Rivals',
    NEMESIS: 'Nemesis',
    LEGEND_RIVALS: 'Legend Rivals',
};
/** Minimum match count to enter each rivalry tier. */
exports.RIVALRY_TIER_MATCH_THRESHOLDS = {
    STRANGERS: 0,
    RIVALS: 3,
    ARCH_RIVALS: 10,
    NEMESIS: 20,
    LEGEND_RIVALS: 50,
};
/** Color per rivalry tier (WCAG AA+ on #0D0D1E). */
exports.RIVALRY_TIER_COLORS = {
    STRANGERS: '#6A6A90', // textDim
    RIVALS: '#B8B8D8', // textSub
    ARCH_RIVALS: '#FF9B2F', // orange
    NEMESIS: '#FF4D4D', // red
    LEGEND_RIVALS: '#9B7DFF', // purple
};
//# sourceMappingURL=battlePhase.js.map