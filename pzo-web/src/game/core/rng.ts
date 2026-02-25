// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/rng.ts
// Sprint 1: Deterministic RNG (extracted from App.tsx)
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deterministic hash of a string → unsigned 32-bit int.
 * Used for seed derivation from mode + userId combos.
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
 * Mulberry32 PRNG — fast, deterministic, seed-reproducible.
 * Returns a new RNG function bound to the given seed.
 * Every call to the returned function advances the sequence.
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
 * Cryptographically random seed from WebCrypto.
 * Falls back to Math.random() in environments without crypto.
 */
export function randomSeed(): number {
  try {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] || Math.floor(Math.random() * 2 ** 32);
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
}

/**
 * Draw n items randomly from a pool using the provided RNG.
 * Returns copies with unique IDs (id suffix prevents hand collisions).
 */
export function drawRandom<T extends { id: string }>(
  pool: T[],
  n: number,
  rng: () => number,
): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const item = pool[Math.floor(rng() * pool.length)];
    if (!item) continue;
    out.push({ ...item, id: `${item.id}-${Math.floor(rng() * 1e9).toString(36)}` });
  }
  return out;
}
