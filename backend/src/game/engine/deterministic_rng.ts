/**
 * POINT ZERO ONE — DETERMINISTIC RNG
 * backend/src/game/engine/deterministic_rng.ts
 *
 * Canonical seeded RNG utilities for backend engine determinism.
 *
 * Goals:
 * - one authoritative seed normalization path
 * - one authoritative PRNG implementation
 * - deterministic seed derivation for sub-systems and pools
 * - deterministic weighted index selection without external deps
 */

export const DEFAULT_NON_ZERO_SEED = 0x9e3779b9;

export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    return DEFAULT_NON_ZERO_SEED;
  }

  const normalized = Math.abs(Math.trunc(seed)) >>> 0;
  return normalized === 0 ? DEFAULT_NON_ZERO_SEED : normalized;
}

export function hashStringToSeed(value: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return normalizeSeed(hash >>> 0);
}

export function combineSeed(seed: number, salt: string | number): number {
  const base = normalizeSeed(seed);
  const saltSeed =
    typeof salt === 'number' ? normalizeSeed(salt) : hashStringToSeed(salt);

  let mixed = normalizeSeed(base ^ saltSeed ^ 0x85ebca6b);
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b);
  mixed ^= mixed >>> 16;

  return normalizeSeed(mixed);
}

export function createMulberry32(seed: number): () => number {
  let state = normalizeSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sanitizePositiveWeights(
  weights: readonly number[] | undefined,
): number[] {
  if (!weights || weights.length === 0) {
    return [];
  }

  return weights.map((weight) => {
    if (!Number.isFinite(weight) || weight <= 0) {
      return 1;
    }

    return weight;
  });
}

export interface DeterministicRng {
  readonly seed: number;
  next(): number;
  nextInt(maxExclusive: number): number;
  nextBetween(minInclusive: number, maxExclusive: number): number;
  nextBoolean(probability?: number): boolean;
  pickIndexByWeights(weights: readonly number[]): number;
}

export function createDeterministicRng(seed: number): DeterministicRng {
  const normalizedSeed = normalizeSeed(seed);
  const nextFloat = createMulberry32(normalizedSeed);

  return {
    seed: normalizedSeed,

    next(): number {
      return nextFloat();
    },

    nextInt(maxExclusive: number): number {
      if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) {
        throw new Error(
          `nextInt(maxExclusive) requires a positive finite integer. Received: ${String(maxExclusive)}`,
        );
      }

      return Math.floor(nextFloat() * Math.floor(maxExclusive));
    },

    nextBetween(minInclusive: number, maxExclusive: number): number {
      if (
        !Number.isFinite(minInclusive) ||
        !Number.isFinite(maxExclusive) ||
        maxExclusive <= minInclusive
      ) {
        throw new Error(
          `nextBetween(minInclusive, maxExclusive) requires maxExclusive > minInclusive. Received: ${String(minInclusive)}, ${String(maxExclusive)}`,
        );
      }

      return minInclusive + Math.floor(nextFloat() * (maxExclusive - minInclusive));
    },

    nextBoolean(probability = 0.5): boolean {
      if (
        !Number.isFinite(probability) ||
        probability < 0 ||
        probability > 1
      ) {
        throw new Error(
          `nextBoolean(probability) requires 0 <= probability <= 1. Received: ${String(probability)}`,
        );
      }

      return nextFloat() < probability;
    },

    pickIndexByWeights(weights: readonly number[]): number {
      const sanitized = sanitizePositiveWeights(weights);

      if (sanitized.length === 0) {
        throw new Error('pickIndexByWeights requires at least one weight.');
      }

      const totalWeight = sanitized.reduce((sum, weight) => sum + weight, 0);

      if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
        throw new Error('pickIndexByWeights requires a positive total weight.');
      }

      let threshold = nextFloat() * totalWeight;

      for (let i = 0; i < sanitized.length; i += 1) {
        threshold -= sanitized[i];
        if (threshold <= 0) {
          return i;
        }
      }

      return sanitized.length - 1;
    },
  };
}