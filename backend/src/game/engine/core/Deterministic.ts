/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

import { createHash } from 'node:crypto';

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return '{' + entries.map(([key, entry]) => JSON.stringify(key) + ':' + stableStringify(entry)).join(',') + '}';
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function checksumSnapshot(value: unknown): string {
  return sha256(stableStringify(value));
}

export function createDeterministicId(seed: string, ...parts: Array<string | number>): string {
  return sha256([seed, ...parts.map(String)].join('::')).slice(0, 24);
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function deepFrozenClone<T>(value: T): T {
  return deepFreeze(cloneJson(value));
}
