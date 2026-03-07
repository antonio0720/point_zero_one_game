"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/format.ts
// Sprint 3: Pure Formatting Utilities — Engine-Complete
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// Zero side effects. Used by UI components, telemetry, and replay builder.
// All functions accept raw numeric/string values and return display strings.
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOT_DISPLAY_NAMES = exports.PRESSURE_TIER_LABELS = exports.TICK_TIER_LABELS = void 0;
exports.fmtMoney = fmtMoney;
exports.fmtMoneyCompact = fmtMoneyCompact;
exports.fmtCashflow = fmtCashflow;
exports.fmtMoneyFull = fmtMoneyFull;
exports.fmtPct01 = fmtPct01;
exports.fmtPct100 = fmtPct100;
exports.fmtROI = fmtROI;
exports.fmtTicks = fmtTicks;
exports.fmtTickMonth = fmtTickMonth;
exports.fmtCountdown = fmtCountdown;
exports.fmtGrade = fmtGrade;
exports.fmtSovereigntyScore = fmtSovereigntyScore;
exports.fmtTickTier = fmtTickTier;
exports.fmtPressureTier = fmtPressureTier;
exports.fmtHash = fmtHash;
exports.fmtRunId = fmtRunId;
exports.capitalize = capitalize;
exports.snakeToTitle = snakeToTitle;
exports.truncate = truncate;
exports.fmtBotName = fmtBotName;
exports.fmtChainId = fmtChainId;
// ── Money Formatting ──────────────────────────────────────────────────────────
/**
 * Format a monetary value with B/M/K suffixes.
 * Negative values are prefixed with '-'.
 * Examples: 1_500_000 → "$1.50M" | -28_000 → "-$28.0K" | 750 → "$750"
 */
function fmtMoney(n) {
    const sign = n < 0 ? '-' : '';
    const v = Math.abs(n);
    if (v >= 1_000_000_000)
        return `${sign}$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1_000_000)
        return `${sign}$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1_000)
        return `${sign}$${(v / 1e3).toFixed(1)}K`;
    return `${sign}$${Math.round(v).toLocaleString()}`;
}
/**
 * Compact money format for tight UI slots (HUD, badges).
 * Less decimal precision: 1_500_000 → "$1.5M" | 28_000 → "$28K"
 */
function fmtMoneyCompact(n) {
    const sign = n < 0 ? '-' : '';
    const v = Math.abs(n);
    if (v >= 1_000_000_000)
        return `${sign}$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1_000_000)
        return `${sign}$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1_000)
        return `${sign}$${Math.round(v / 1_000)}K`;
    return `${sign}$${Math.round(v)}`;
}
/**
 * Format monthly cashflow with explicit +/- sign.
 * Used in card stats, balance sheet.
 * Example: 1_200 → "+$1,200/mo" | -800 → "-$800/mo"
 */
function fmtCashflow(monthly) {
    const sign = monthly >= 0 ? '+' : '';
    return `${sign}${fmtMoney(monthly)}/mo`;
}
/** Format a raw dollar amount for full-precision display. */
function fmtMoneyFull(n) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(n);
}
// ── Percentage Formatting ─────────────────────────────────────────────────────
/** Format a 0–1 float as a percentage string. Example: 0.75 → "75%" */
function fmtPct01(n) {
    return `${Math.round(n * 100)}%`;
}
/** Format a 0–100 value as a percentage string. Example: 75.5 → "75.5%" */
function fmtPct100(n, decimals = 1) {
    return `${n.toFixed(decimals)}%`;
}
/** Format a decimal ROI value. Example: 0.19 → "19.0% ROI" */
function fmtROI(roiDecimal) {
    return `${(roiDecimal * 100).toFixed(1)}% ROI`;
}
// ── Tick / Time Formatting ─────────────────────────────────────────────────────
/**
 * Format a tick count as a duration string.
 * Uses TICK_MS to compute real-world time equivalent.
 * Example: 120 ticks at 1000ms → "2m 0s"
 */
function fmtTicks(ticks, tickMs = 1000) {
    const totalMs = ticks * tickMs;
    const totalSec = Math.floor(totalMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
/** Format ticks as a month/tick hybrid: "M6 T72" */
function fmtTickMonth(tick, ticksPerMonth = 12) {
    const month = Math.floor(tick / ticksPerMonth) + 1;
    return `M${month} T${tick}`;
}
/** Format a remaining tick countdown. Example: 48 → "48 ticks left" */
function fmtCountdown(ticksRemaining) {
    if (ticksRemaining <= 0)
        return 'Time out';
    if (ticksRemaining === 1)
        return '1 tick left';
    return `${ticksRemaining} ticks left`;
}
// ── Score & Grade Formatting ───────────────────────────────────────────────────
/** Format a run grade with display label. Example: 'S' → "S — SOVEREIGN" */
function fmtGrade(grade) {
    const labels = {
        S: 'SOVEREIGN', A: 'ARCHITECT', B: 'BUILDER',
        C: 'CONTRACTOR', D: 'DRIFTER', F: 'FRACTURED',
    };
    return `${grade} — ${labels[grade] ?? 'UNKNOWN'}`;
}
/** Format a sovereignty score with comma separators. */
function fmtSovereigntyScore(score) {
    return score.toLocaleString('en-US') + ' pts';
}
// ── Pressure / Tick Tier Formatting ───────────────────────────────────────────
exports.TICK_TIER_LABELS = {
    T0: 'SOVEREIGN', T1: 'STABLE', T2: 'COMPRESSED', T3: 'CRISIS', T4: 'COLLAPSE',
};
exports.PRESSURE_TIER_LABELS = {
    CALM: 'CALM', BUILDING: 'BUILDING', ELEVATED: 'ELEVATED',
    HIGH: 'HIGH', CRITICAL: 'CRITICAL',
};
/** Human-readable tick tier. */
function fmtTickTier(tier) {
    return exports.TICK_TIER_LABELS[tier] ?? tier;
}
/** Human-readable pressure tier. */
function fmtPressureTier(tier) {
    return exports.PRESSURE_TIER_LABELS[tier] ?? tier;
}
// ── ID / Hash Formatting ──────────────────────────────────────────────────────
/** Truncate a proof hash for display: 'abc123def456...' → 'abc123de…' */
function fmtHash(hash, len = 8) {
    if (hash.length <= len)
        return hash;
    return hash.slice(0, len) + '…';
}
/** Format a run ID for display. */
function fmtRunId(runId) {
    return runId.length > 16 ? runId.slice(0, 14) + '…' : runId;
}
// ── String Utilities ──────────────────────────────────────────────────────────
/** Capitalize first letter of a string. */
function capitalize(s) {
    if (!s)
        return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}
/** Convert a SNAKE_CASE string to Title Case. */
function snakeToTitle(s) {
    return s
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
/** Truncate a string to maxLen with ellipsis. */
function truncate(s, maxLen) {
    if (s.length <= maxLen)
        return s;
    return s.slice(0, maxLen - 1) + '…';
}
// ── Bot / Card Name Formatting ────────────────────────────────────────────────
exports.BOT_DISPLAY_NAMES = {
    BOT_01_LIQUIDATOR: 'The Liquidator',
    BOT_02_BUREAUCRAT: 'The Bureaucrat',
    BOT_03_MANIPULATOR: 'The Manipulator',
    BOT_04_CRASH_PROPHET: 'The Crash Prophet',
    BOT_05_LEGACY_HEIR: 'The Legacy Heir',
    // Short-form aliases (legacy)
    BOT_01: 'The Liquidator',
    BOT_02: 'The Bureaucrat',
    BOT_03: 'The Manipulator',
    BOT_04: 'The Crash Prophet',
    BOT_05: 'The Legacy Heir',
};
/** Resolve a bot ID to its display name. */
function fmtBotName(botId) {
    return exports.BOT_DISPLAY_NAMES[botId] ?? botId;
}
/** Format a cascade chain ID to human-readable. */
function fmtChainId(chainId) {
    return chainId
        .replace(/^(CHAIN_|PCHAIN_)/, '')
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
//# sourceMappingURL=format.js.map