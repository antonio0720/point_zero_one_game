// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/format.ts
// Sprint 1: Pure Formatting Utilities (extracted from App.tsx)
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

/** Format a monetary value with B/M/K suffixes. */
export function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 1_000_000_000) return `${sign}$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1_000_000)     return `${sign}$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1_000)         return `${sign}$${(v / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(v).toLocaleString()}`;
}

/** Format a 0–1 float as a percentage string. */
export function fmtPct01(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Format a tick count as "Mm Ss" style duration. */
export function fmtTicks(ticks: number, tickMs = 1000): string {
  const totalMs = ticks * tickMs;
  const s = Math.floor(totalMs / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

/** Capitalize first letter of a string. */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
