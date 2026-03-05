/**
 * Format a monetary value with B/M/K suffixes.
 * Negative values are prefixed with '-'.
 * Examples: 1_500_000 → "$1.50M" | -28_000 → "-$28.0K" | 750 → "$750"
 */
export declare function fmtMoney(n: number): string;
/**
 * Compact money format for tight UI slots (HUD, badges).
 * Less decimal precision: 1_500_000 → "$1.5M" | 28_000 → "$28K"
 */
export declare function fmtMoneyCompact(n: number): string;
/**
 * Format monthly cashflow with explicit +/- sign.
 * Used in card stats, balance sheet.
 * Example: 1_200 → "+$1,200/mo" | -800 → "-$800/mo"
 */
export declare function fmtCashflow(monthly: number): string;
/** Format a raw dollar amount for full-precision display. */
export declare function fmtMoneyFull(n: number): string;
/** Format a 0–1 float as a percentage string. Example: 0.75 → "75%" */
export declare function fmtPct01(n: number): string;
/** Format a 0–100 value as a percentage string. Example: 75.5 → "75.5%" */
export declare function fmtPct100(n: number, decimals?: number): string;
/** Format a decimal ROI value. Example: 0.19 → "19.0% ROI" */
export declare function fmtROI(roiDecimal: number): string;
/**
 * Format a tick count as a duration string.
 * Uses TICK_MS to compute real-world time equivalent.
 * Example: 120 ticks at 1000ms → "2m 0s"
 */
export declare function fmtTicks(ticks: number, tickMs?: number): string;
/** Format ticks as a month/tick hybrid: "M6 T72" */
export declare function fmtTickMonth(tick: number, ticksPerMonth?: number): string;
/** Format a remaining tick countdown. Example: 48 → "48 ticks left" */
export declare function fmtCountdown(ticksRemaining: number): string;
/** Format a run grade with display label. Example: 'S' → "S — SOVEREIGN" */
export declare function fmtGrade(grade: string): string;
/** Format a sovereignty score with comma separators. */
export declare function fmtSovereigntyScore(score: number): string;
export declare const TICK_TIER_LABELS: Record<string, string>;
export declare const PRESSURE_TIER_LABELS: Record<string, string>;
/** Human-readable tick tier. */
export declare function fmtTickTier(tier: string): string;
/** Human-readable pressure tier. */
export declare function fmtPressureTier(tier: string): string;
/** Truncate a proof hash for display: 'abc123def456...' → 'abc123de…' */
export declare function fmtHash(hash: string, len?: number): string;
/** Format a run ID for display. */
export declare function fmtRunId(runId: string): string;
/** Capitalize first letter of a string. */
export declare function capitalize(s: string): string;
/** Convert a SNAKE_CASE string to Title Case. */
export declare function snakeToTitle(s: string): string;
/** Truncate a string to maxLen with ellipsis. */
export declare function truncate(s: string, maxLen: number): string;
export declare const BOT_DISPLAY_NAMES: Record<string, string>;
/** Resolve a bot ID to its display name. */
export declare function fmtBotName(botId: string): string;
/** Format a cascade chain ID to human-readable. */
export declare function fmtChainId(chainId: string): string;
//# sourceMappingURL=format.d.ts.map