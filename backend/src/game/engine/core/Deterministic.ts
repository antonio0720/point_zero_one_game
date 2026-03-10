/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/Deterministic.ts
 *
 * Doctrine:
 * - deterministic serialization is a first-class primitive
 * - proof_hash inputs must be stable across platforms and runs
 * - replay, CORD, verification, and audit surfaces all depend on canonical encoding
 */

import { createHash } from 'node:crypto';

type JsonPrimitive = string | number | boolean | null;
type CanonicalValue =
  | JsonPrimitive
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Non-finite numbers are not supported in canonical serialization: ${String(value)}`);
  }

  if (Object.is(value, -0)) {
    return 0;
  }

  return value;
}

function toCanonicalValue(value: unknown, seen: WeakSet<object>): CanonicalValue {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return normalizeNumber(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return Buffer.from(value).toString('base64');
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toCanonicalValue(entry, seen));
  }

  if (value instanceof Set) {
    return Array.from(value.values()).map((entry) => toCanonicalValue(entry, seen));
  }

  if (value instanceof Map) {
    const mapped: Record<string, CanonicalValue> = {};
    const entries = Array.from(value.entries()).sort(([a], [b]) =>
      String(a).localeCompare(String(b)),
    );

    for (const [key, entry] of entries) {
      mapped[String(key)] = toCanonicalValue(entry, seen);
    }

    return mapped;
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) {
      throw new Error('Circular structures are not supported in canonical serialization.');
    }

    seen.add(value);

    const normalized: Record<string, CanonicalValue> = {};
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));

    for (const key of keys) {
      const entry = value[key];

      if (entry === undefined) {
        continue;
      }

      normalized[key] = toCanonicalValue(entry, seen);
    }

    seen.delete(value);
    return normalized;
  }

  throw new Error(
    `Unsupported value encountered in canonical serialization: ${Object.prototype.toString.call(value)}`,
  );
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value, new WeakSet()));
}

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function checksumSnapshot(value: unknown): string {
  return sha256(stableStringify(value));
}

export function checksumParts(...parts: unknown[]): string {
  return sha256(stableStringify(parts));
}

export function createDeterministicId(
  namespace: string,
  ...parts: Array<string | number | boolean | null | undefined>
): string {
  if (!namespace || namespace.trim().length === 0) {
    throw new Error('createDeterministicId requires a non-empty namespace.');
  }

  const payload = [
    namespace.trim(),
    ...parts.map((part) => (part === undefined ? 'undefined' : String(part))),
  ];

  return sha256(payload.join('::')).slice(0, 24);
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value as object)) {
    return value;
  }

  seen.add(value as object);

  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry, seen);
    }
  } else {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested, seen);
    }
  }

  return Object.freeze(value);
}

export function deepFrozenClone<T>(value: T): T {
  return deepFreeze(cloneJson(value));
}

export interface ProofHashInput {
  readonly seed: string;
  readonly tickStreamChecksum: string;
  readonly outcome: string;
  readonly finalNetWorth: number;
  readonly userId: string;
}

export function computeProofHash(input: ProofHashInput): string {
  return sha256(
    stableStringify({
      seed: input.seed,
      tickStreamChecksum: input.tickStreamChecksum,
      outcome: input.outcome,
      finalNetWorth: normalizeNumber(input.finalNetWorth),
      userId: input.userId,
    }),
  );
}

export interface TickSealInput {
  readonly runId: string;
  readonly tick: number;
  readonly step: string;
  readonly stateChecksum: string;
  readonly eventChecksums: readonly string[];
}

export function computeTickSeal(input: TickSealInput): string {
  return sha256(
    stableStringify({
      runId: input.runId,
      tick: input.tick,
      step: input.step,
      stateChecksum: input.stateChecksum,
      eventChecksums: [...input.eventChecksums],
    }),
  );
}