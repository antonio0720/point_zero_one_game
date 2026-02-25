// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/constants.ts
// Sprint 1: Runtime Constants (extracted from App.tsx)
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

// ── Run Lifecycle ─────────────────────────────────────────────────────────────
export const STARTING_CASH     = 28_000;
export const STARTING_INCOME   = 2_100;
export const STARTING_EXPENSES = 4_800;
export const RUN_TICKS         = 720;
export const MONTH_TICKS       = 12;
export const TICK_MS           = 1000;

// ── Card Mechanics ────────────────────────────────────────────────────────────
export const DRAW_TICKS        = 24;
export const MAX_HAND          = 5;
export const MAX_LOG           = 80;
export const MAX_EQUITY_POINTS = 120;

// ── Fate Deck Probabilities ───────────────────────────────────────────────────
// NOTE: These are the legacy fixed probabilities.
// Sprint 2 will replace these with forcedEventEngine dynamic probabilities.
export const FATE_TICKS        = 18;
export const FATE_FUBAR_PCT    = 0.42;
export const FATE_MISSED_PCT   = 0.32;
export const FATE_SO_PCT       = 0.21;
// PRIVILEGED = 1 - (FUBAR + MISSED + SO) = 0.05

// ── Sabotage ──────────────────────────────────────────────────────────────────
export const SABOTAGE_BASE_TICKS = 24;

// ── Shield Economics ──────────────────────────────────────────────────────────
export const SHIELD_BANKRUPTCY_RECOVERY = 5_000;  // cash restored when shield absorbs bankrupt

// ── ML Modifiers ─────────────────────────────────────────────────────────────
export const ML_ALPHA_DRAW_REROUTE_THRESHOLD = 0.20;  // alpha - risk margin to trigger smart draw
export const ML_ALPHA_DRAW_REROUTE_CHANCE    = 0.55;  // % chance of reroute when above threshold

// ── Season ────────────────────────────────────────────────────────────────────
export const SEASON_PULSE_TICKS = 60;
export const XP_PER_MONTH_CASHFLOW_UNIT = 500;  // $500 cashflow = 1 XP
export const XP_MIN_PER_SETTLEMENT = 5;

// ── PvP / Ghost ───────────────────────────────────────────────────────────────
export const BATTLE_ROUND_TICKS = 60;
export const GHOST_TICK_INTERVAL = 75;
export const MACRO_EVENT_TICKS   = 55;
export const INTEGRITY_CHECK_TICKS = 45;
export const RESCUE_WINDOW_INTERVAL = 120;
export const RESCUE_WINDOW_DURATION = 30;
export const RESCUE_WINDOW_CHANCE   = 0.25;
