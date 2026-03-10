/**
 * POINT ZERO ONE — DETERMINISTIC SEED GENERATOR
 * backend/src/game/engine/seed_generator.ts
 *
 * Replaces nondeterministic Date.now / Math.random seed creation with
 * reproducible seed derivation and seed commitments.
 */

import { createHash } from 'node:crypto';
import { combineSeed, hashStringToSeed, normalizeSeed } from './deterministic_rng';

export interface SeedMaterial {
  readonly runId: string | number;
  readonly namespace?: string;
  readonly mode?: string;
  readonly salt?: string | number;
}

export interface SeedCommitment {
  readonly seed: number;
  readonly seedHex: string;
  readonly commitment: string;
  readonly canonicalMaterial: string;
}

function toCanonicalMaterial(material: SeedMaterial): string {
  const namespace = material.namespace ?? 'pzo';
  const mode = material.mode ?? 'default';
  const salt = material.salt === undefined ? 'none' : String(material.salt);

  return [
    `namespace=${namespace}`,
    `mode=${mode}`,
    `runId=${String(material.runId)}`,
    `salt=${salt}`,
  ].join('|');
}

export function deriveNumericSeed(material: SeedMaterial): number {
  const canonicalMaterial = toCanonicalMaterial(material);
  const baseSeed = hashStringToSeed(canonicalMaterial);

  if (material.salt === undefined) {
    return normalizeSeed(baseSeed);
  }

  return combineSeed(baseSeed, material.salt);
}

/**
 * Backward-compatible surface.
 * Returns a deterministic seed commitment string for the provided run ID.
 */
export function generateSeed(runId: number): string {
  return generateSeedCommitment({ runId }).commitment;
}

export function generateSeedCommitment(material: SeedMaterial): SeedCommitment {
  const canonicalMaterial = toCanonicalMaterial(material);
  const seed = deriveNumericSeed(material);
  const seedHex = seed.toString(16).padStart(8, '0');

  const commitment = createHash('sha256')
    .update(`${canonicalMaterial}|seedHex=${seedHex}`, 'utf8')
    .digest('hex');

  return {
    seed,
    seedHex,
    commitment,
    canonicalMaterial,
  };
}