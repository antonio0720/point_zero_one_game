// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/math.ts
// Sprint 1: Pure Math Utilities (extracted from App.tsx)
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function pct(value: number, total: number): number {
  if (total === 0) return 0;
  return clamp(value / total, 0, 1);
}

export function idNum(id: string): number {
  const m = id.match(/M(\d+)/i);
  return m ? Number(m[1]) : 0;
}
