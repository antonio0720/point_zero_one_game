/**
 * FNV-1a 32-bit hash of a string → unsigned 32-bit int.
 * Deterministic. Used for seed derivation from mode + userId combos.
 */
export declare function hashString(input: string): number;
/**
 * Combine two 32-bit seeds into one deterministically.
 * Used for per-mode seed derivation: combineSeed(runSeed, modeHash).
 */
export declare function combineSeed(a: number, b: number): number;
/**
 * Mulberry32 PRNG — fast, deterministic, seed-reproducible.
 * Period: ~2^32. Passes BigCrush in practice.
 * Returns a new RNG closure bound to the given seed.
 * Each call to the returned function advances the sequence by 1 step.
 */
export declare function mulberry32(seed: number): () => number;
/**
 * Fork a derived RNG from an existing one — produces a new seed using
 * the parent's next value, keeping the parent's sequence intact.
 * Use this to give each engine its own independent RNG without drift.
 */
export declare function forkRng(rng: () => number): () => number;
/**
 * Cryptographically random seed from WebCrypto.
 * Falls back to Math.random() in SSR / Node environments.
 */
export declare function randomSeed(): number;
/**
 * Derive a deterministic seed for a specific engine from a run seed + engine ID.
 * Ensures each engine gets a unique-but-reproducible seed.
 */
export declare function deriveEngineSeed(runSeed: number, engineId: string): number;
/**
 * Draw n items randomly from a pool using the provided RNG.
 * Each drawn item gets a unique suffix on its ID to prevent hand collisions.
 * Non-destructive — pool is not mutated.
 */
export declare function drawRandom<T extends {
    id: string;
}>(pool: T[], n: number, rng: () => number): T[];
/**
 * Fisher-Yates shuffle using the provided RNG.
 * Returns a new shuffled array — source array is NOT mutated.
 */
export declare function shuffleArray<T>(arr: T[], rng: () => number): T[];
/**
 * Weighted random selection from an array of items with weight fields.
 * Returns null if array is empty.
 */
export declare function weightedPick<T extends {
    weight: number;
}>(items: T[], rng: () => number): T | null;
/**
 * Random integer in [min, max] inclusive.
 */
export declare function randInt(min: number, max: number, rng: () => number): number;
/**
 * Random float in [min, max).
 */
export declare function randFloat(min: number, max: number, rng: () => number): number;
/**
 * Generate a deterministic ID string from a seed + counter.
 * Used for cascade chain IDs, attack event IDs, etc.
 * Format: "pzo_{base36_8chars}"
 */
export declare function seededId(rng: () => number): string;
/**
 * Compute a jittered arrival tick for a bot attack.
 * Base tick ± up to jitterTicks, using seeded RNG.
 */
export declare function jitteredTick(baseTick: number, jitterTicks: number, rng: () => number): number;
//# sourceMappingURL=rng.d.ts.map