// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/rng.ts
// Sprint 3: Deterministic RNG — Engine-Complete
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// All game randomness flows through these functions.
// Determinism guarantee: same seed + same sequence = same output.
// 20M-scale safe: no global state, each RNG is an isolated closure.
// ═══════════════════════════════════════════════════════════════════════════

// ── Hashing ───────────────────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit hash of a string → unsigned 32-bit int.
 * Deterministic. Used for seed derivation from mode + userId combos.
 */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Combine two 32-bit seeds into one deterministically.
 * Used for per-mode seed derivation: combineSeed(runSeed, modeHash).
 */
export function combineSeed(a: number, b: number): number {
  // Szudzik pairing function — produces unique outputs for unique (a,b) pairs
  return a >= b
    ? a * a + a + b
    : a + b * b;
}

// ── Mulberry32 PRNG ───────────────────────────────────────────────────────────

/**
 * Mulberry32 PRNG — fast, deterministic, seed-reproducible.
 * Period: ~2^32. Passes BigCrush in practice.
 * Returns a new RNG closure bound to the given seed.
 * Each call to the returned function advances the sequence by 1 step.
 */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function rng(): number {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fork a derived RNG from an existing one — produces a new seed using
 * the parent's next value, keeping the parent's sequence intact.
 * Use this to give each engine its own independent RNG without drift.
 */
export function forkRng(rng: () => number): () => number {
  const childSeed = Math.floor(rng() * 2 ** 32);
  return mulberry32(childSeed);
}

// ── Seed Generation ────────────────────────────────────────────────────────────

/**
 * Cryptographically random seed from WebCrypto.
 * Falls back to Math.random() in SSR / Node environments.
 */
export function randomSeed(): number {
  try {
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return arr[0] || Math.floor(Math.random() * 2 ** 32);
    }
    // Node.js / SSR
    if (typeof globalThis.crypto !== 'undefined') {
      const arr = new Uint32Array(1);
      globalThis.crypto.getRandomValues(arr);
      return arr[0] || Math.floor(Math.random() * 2 ** 32);
    }
  } catch {
    // intentional fallthrough
  }
  return Math.floor(Math.random() * 2 ** 32);
}

/**
 * Derive a deterministic seed for a specific engine from a run seed + engine ID.
 * Ensures each engine gets a unique-but-reproducible seed.
 */
export function deriveEngineSeed(runSeed: number, engineId: string): number {
  return combineSeed(runSeed, hashString(engineId)) >>> 0;
}

// ── Sampling Utilities ────────────────────────────────────────────────────────

/**
 * Draw n items randomly from a pool using the provided RNG.
 * Each drawn item gets a unique suffix on its ID to prevent hand collisions.
 * Non-destructive — pool is not mutated.
 */
export function drawRandom<T extends { id: string }>(
  pool: T[],
  n:    number,
  rng:  () => number,
): T[] {
  if (pool.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const item = pool[Math.floor(rng() * pool.length)];
    if (!item) continue;
    out.push({ ...item, id: `${item.id}-${Math.floor(rng() * 1e9).toString(36)}` });
  }
  return out;
}

/**
 * Fisher-Yates shuffle using the provided RNG.
 * Returns a new shuffled array — source array is NOT mutated.
 */
export function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Weighted random selection from an array of items with weight fields.
 * Returns null if array is empty.
 */
export function weightedPick<T extends { weight: number }>(
  items: T[],
  rng:   () => number,
): T | null {
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];

  let threshold = rng() * total;
  for (const item of items) {
    threshold -= item.weight;
    if (threshold <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Random integer in [min, max] inclusive.
 */
export function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Random float in [min, max).
 */
export function randFloat(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min);
}

// ── Seeded UUID-like Generator ────────────────────────────────────────────────

/**
 * Generate a deterministic ID string from a seed + counter.
 * Used for cascade chain IDs, attack event IDs, etc.
 * Format: "pzo_{base36_8chars}"
 */
export function seededId(rng: () => number): string {
  return `pzo_${Math.floor(rng() * 2.8e14).toString(36).padStart(8, '0')}`;
}

// ── Bot Timing Utility ────────────────────────────────────────────────────────

/**
 * Compute a jittered arrival tick for a bot attack.
 * Base tick ± up to jitterTicks, using seeded RNG.
 */
export function jitteredTick(
  baseTick:    number,
  jitterTicks: number,
  rng:         () => number,
): number {
  const jitter = Math.round((rng() * 2 - 1) * jitterTicks);
  return Math.max(0, baseTick + jitter);
}
