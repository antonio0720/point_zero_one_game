// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/format.ts
// Sprint 3: Pure Formatting Utilities — Engine-Complete
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// Zero side effects. Used by UI components, telemetry, and replay builder.
// All functions accept raw numeric/string values and return display strings.
// ═══════════════════════════════════════════════════════════════════════════

// ── Money Formatting ──────────────────────────────────────────────────────────

/**
 * Format a monetary value with B/M/K suffixes.
 * Negative values are prefixed with '-'.
 * Examples: 1_500_000 → "$1.50M" | -28_000 → "-$28.0K" | 750 → "$750"
 */
export function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const v    = Math.abs(n);
  if (v >= 1_000_000_000) return `${sign}$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1_000_000)     return `${sign}$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1_000)         return `${sign}$${(v / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(v).toLocaleString()}`;
}

/**
 * Compact money format for tight UI slots (HUD, badges).
 * Less decimal precision: 1_500_000 → "$1.5M" | 28_000 → "$28K"
 */
export function fmtMoneyCompact(n: number): string {
  const sign = n < 0 ? '-' : '';
  const v    = Math.abs(n);
  if (v >= 1_000_000_000) return `${sign}$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1_000_000)     return `${sign}$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1_000)         return `${sign}$${Math.round(v / 1_000)}K`;
  return `${sign}$${Math.round(v)}`;
}

/**
 * Format monthly cashflow with explicit +/- sign.
 * Used in card stats, balance sheet.
 * Example: 1_200 → "+$1,200/mo" | -800 → "-$800/mo"
 */
export function fmtCashflow(monthly: number): string {
  const sign = monthly >= 0 ? '+' : '';
  return `${sign}${fmtMoney(monthly)}/mo`;
}

/** Format a raw dollar amount for full-precision display. */
export function fmtMoneyFull(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Percentage Formatting ─────────────────────────────────────────────────────

/** Format a 0–1 float as a percentage string. Example: 0.75 → "75%" */
export function fmtPct01(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Format a 0–100 value as a percentage string. Example: 75.5 → "75.5%" */
export function fmtPct100(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

/** Format a decimal ROI value. Example: 0.19 → "19.0% ROI" */
export function fmtROI(roiDecimal: number): string {
  return `${(roiDecimal * 100).toFixed(1)}% ROI`;
}

// ── Tick / Time Formatting ─────────────────────────────────────────────────────

/**
 * Format a tick count as a duration string.
 * Uses TICK_MS to compute real-world time equivalent.
 * Example: 120 ticks at 1000ms → "2m 0s"
 */
export function fmtTicks(ticks: number, tickMs = 1000): string {
  const totalMs  = ticks * tickMs;
  const totalSec = Math.floor(totalMs / 1000);
  const mins     = Math.floor(totalSec / 60);
  const secs     = totalSec % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

/** Format ticks as a month/tick hybrid: "M6 T72" */
export function fmtTickMonth(tick: number, ticksPerMonth = 12): string {
  const month = Math.floor(tick / ticksPerMonth) + 1;
  return `M${month} T${tick}`;
}

/** Format a remaining tick countdown. Example: 48 → "48 ticks left" */
export function fmtCountdown(ticksRemaining: number): string {
  if (ticksRemaining <= 0) return 'Time out';
  if (ticksRemaining === 1) return '1 tick left';
  return `${ticksRemaining} ticks left`;
}

// ── Score & Grade Formatting ───────────────────────────────────────────────────

/** Format a run grade with display label. Example: 'S' → "S — SOVEREIGN" */
export function fmtGrade(grade: string): string {
  const labels: Record<string, string> = {
    S: 'SOVEREIGN', A: 'ARCHITECT', B: 'BUILDER',
    C: 'CONTRACTOR', D: 'DRIFTER', F: 'FRACTURED',
  };
  return `${grade} — ${labels[grade] ?? 'UNKNOWN'}`;
}

/** Format a sovereignty score with comma separators. */
export function fmtSovereigntyScore(score: number): string {
  return score.toLocaleString('en-US') + ' pts';
}

// ── Pressure / Tick Tier Formatting ───────────────────────────────────────────

export const TICK_TIER_LABELS: Record<string, string> = {
  T0: 'SOVEREIGN', T1: 'STABLE', T2: 'COMPRESSED', T3: 'CRISIS', T4: 'COLLAPSE',
};

export const PRESSURE_TIER_LABELS: Record<string, string> = {
  CALM: 'CALM', BUILDING: 'BUILDING', ELEVATED: 'ELEVATED',
  HIGH: 'HIGH', CRITICAL: 'CRITICAL',
};

/** Human-readable tick tier. */
export function fmtTickTier(tier: string): string {
  return TICK_TIER_LABELS[tier] ?? tier;
}

/** Human-readable pressure tier. */
export function fmtPressureTier(tier: string): string {
  return PRESSURE_TIER_LABELS[tier] ?? tier;
}

// ── ID / Hash Formatting ──────────────────────────────────────────────────────

/** Truncate a proof hash for display: 'abc123def456...' → 'abc123de…' */
export function fmtHash(hash: string, len = 8): string {
  if (hash.length <= len) return hash;
  return hash.slice(0, len) + '…';
}

/** Format a run ID for display. */
export function fmtRunId(runId: string): string {
  return runId.length > 16 ? runId.slice(0, 14) + '…' : runId;
}

// ── String Utilities ──────────────────────────────────────────────────────────

/** Capitalize first letter of a string. */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Convert a SNAKE_CASE string to Title Case. */
export function snakeToTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Truncate a string to maxLen with ellipsis. */
export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + '…';
}

// ── Bot / Card Name Formatting ────────────────────────────────────────────────

export const BOT_DISPLAY_NAMES: Record<string, string> = {
  BOT_01_LIQUIDATOR:   'The Liquidator',
  BOT_02_BUREAUCRAT:   'The Bureaucrat',
  BOT_03_MANIPULATOR:  'The Manipulator',
  BOT_04_CRASH_PROPHET:'The Crash Prophet',
  BOT_05_LEGACY_HEIR:  'The Legacy Heir',
  // Short-form aliases (legacy)
  BOT_01: 'The Liquidator',
  BOT_02: 'The Bureaucrat',
  BOT_03: 'The Manipulator',
  BOT_04: 'The Crash Prophet',
  BOT_05: 'The Legacy Heir',
};

/** Resolve a bot ID to its display name. */
export function fmtBotName(botId: string): string {
  return BOT_DISPLAY_NAMES[botId] ?? botId;
}

/** Format a cascade chain ID to human-readable. */
export function fmtChainId(chainId: string): string {
  return chainId
    .replace(/^(CHAIN_|PCHAIN_)/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
