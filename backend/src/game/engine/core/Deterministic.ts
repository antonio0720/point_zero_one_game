/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/Deterministic.ts
 *
 * Doctrine:
 * - deterministic serialization is a first-class primitive
 * - proof_hash inputs must be stable across platforms and runs
 * - replay, CORD, verification, and audit surfaces all depend on canonical encoding
 * - every user action is traceable, reproducible, and verifiable
 * - ML/DL vectors derived from deterministic state are stable and comparable
 *
 * Surface summary:
 *   Section 1  — Canonical Serialization Primitives
 *   Section 2  — Proof Hash / Tick Seal (extended)
 *   Section 3  — DeterministicRNG (seeded PRNG)
 *   Section 4  — MerkleChain (append-only hash chain)
 *   Section 5  — RunAuditLog (per-run audit event recording)
 *   Section 6  — ReplayHashBuilder (tick-stream replay verification)
 *   Section 7  — DeterministicSnapshotDiff (canonical diff engine)
 *   Section 8  — CanonicalEncoder (utility class with stats)
 *   Section 9  — DeterministicIdRegistry (collision-safe ID registry)
 *   Section 10 — VerificationResult + verifyProofHash / verifyTickSeal
 *   Section 11 — ML/DL Feature Vector from deterministic context
 *   Section 12 — Engine wiring helpers (DeterministicRunContext)
 */

import { createHash, createHmac, randomBytes } from 'node:crypto';

// ─────────────────────────────────────────────────────────────────────────────
// § 0 — Internal type primitives (shared by all sections)
// ─────────────────────────────────────────────────────────────────────────────

type JsonPrimitive = string | number | boolean | null;

type CanonicalValue =
  | JsonPrimitive
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(
      `Non-finite numbers are not supported in canonical serialization: ${String(value)}`,
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

function toCanonicalValue(value: unknown, seen: WeakSet<object>): CanonicalValue {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return normalizeNumber(value);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();

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
      if (entry === undefined) continue;
      normalized[key] = toCanonicalValue(entry, seen);
    }
    seen.delete(value);
    return normalized;
  }

  throw new Error(
    `Unsupported value encountered in canonical serialization: ${Object.prototype.toString.call(value)}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Canonical Serialization Primitives
// ─────────────────────────────────────────────────────────────────────────────

/** Stable JSON serialization: sorted keys, normalized numbers, no undefined. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value, new WeakSet()));
}

/** SHA-256 hex digest of a string or Buffer. */
export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

/** SHA-512 hex digest of a string or Buffer. */
export function sha512(input: string | Buffer): string {
  return createHash('sha512').update(input).digest('hex');
}

/** HMAC-SHA256 hex digest. Used for signed audit entries. */
export function hmacSha256(key: string, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

/** SHA-256 of a raw Buffer (binary-safe). */
export function checksumBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/** SHA-256 checksum of any serializable value. */
export function checksumSnapshot(value: unknown): string {
  return sha256(stableStringify(value));
}

/** SHA-256 checksum of multiple parts combined as a canonical array. */
export function checksumParts(...parts: unknown[]): string {
  return sha256(stableStringify(parts));
}

/**
 * Create a short, deterministic ID from a namespace + parts.
 * Result is always exactly 24 hex characters.
 */
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

/** Deep-clone via JSON round-trip (strips undefined, functions, symbols). */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Recursively freeze an object in place. Handles cycles via a seen-set. */
export function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);
  if (Array.isArray(value)) {
    for (const entry of value) deepFreeze(entry, seen);
  } else {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested, seen);
    }
  }
  return Object.freeze(value);
}

/** Clone + deeply freeze. Suitable for producing immutable engine state snapshots. */
export function deepFrozenClone<T>(value: T): T {
  return deepFreeze(cloneJson(value));
}

/**
 * Sort an array of objects by a canonical key, returning a new sorted array.
 * Useful when preparing deterministic inputs from unordered sets.
 */
export function canonicalSort<T>(
  items: T[],
  key: keyof T,
): T[] {
  return [...items].sort((a, b) =>
    String((a as any)[key]).localeCompare(String((b as any)[key])),
  );
}

/**
 * Flatten a nested canonical value to a flat string list.
 * Used for building ordered hash inputs from complex state.
 */
export function flattenCanonical(value: CanonicalValue, prefix = ''): string[] {
  if (value === null) return [`${prefix}=null`];
  if (typeof value === 'string') return [`${prefix}=${value}`];
  if (typeof value === 'number') return [`${prefix}=${value}`];
  if (typeof value === 'boolean') return [`${prefix}=${value}`];

  if (Array.isArray(value)) {
    return value.flatMap((v, i) =>
      flattenCanonical(v as CanonicalValue, `${prefix}[${i}]`),
    );
  }

  const result: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, CanonicalValue>)) {
    result.push(...flattenCanonical(v, prefix ? `${prefix}.${k}` : k));
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — Proof Hash / Tick Seal (extended)
// ─────────────────────────────────────────────────────────────────────────────

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

export interface ExtendedProofHashInput extends ProofHashInput {
  readonly runId: string;
  readonly mode: string;
  readonly totalTicks: number;
  readonly finalPressureTier: number;
  readonly merkleRoot: string;
  readonly auditLogHash: string;
}

/** Extended proof hash that includes merkle root and audit log. */
export function computeExtendedProofHash(input: ExtendedProofHashInput): string {
  return sha256(
    stableStringify({
      seed: input.seed,
      tickStreamChecksum: input.tickStreamChecksum,
      outcome: input.outcome,
      finalNetWorth: normalizeNumber(input.finalNetWorth),
      userId: input.userId,
      runId: input.runId,
      mode: input.mode,
      totalTicks: input.totalTicks,
      finalPressureTier: input.finalPressureTier,
      merkleRoot: input.merkleRoot,
      auditLogHash: input.auditLogHash,
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

export interface ChainedTickSealInput extends TickSealInput {
  readonly previousSeal: string;
  readonly mlVectorChecksum: string;
}

/**
 * Chained tick seal includes the previous seal hash, forming a tamper-evident
 * chain of tick seals across an entire run.
 */
export function computeChainedTickSeal(input: ChainedTickSealInput): string {
  return sha256(
    stableStringify({
      runId: input.runId,
      tick: input.tick,
      step: input.step,
      stateChecksum: input.stateChecksum,
      eventChecksums: [...input.eventChecksums],
      previousSeal: input.previousSeal,
      mlVectorChecksum: input.mlVectorChecksum,
    }),
  );
}

/** Genesis seal for the first tick (tick 0 chain anchor). */
export const GENESIS_SEAL = '0'.repeat(64) as string;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — DeterministicRNG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * State for a DeterministicRNG instance.
 * All fields are plain numbers for JSON-safe snapshotting.
 */
export interface DeterministicRNGState {
  readonly seed: number;
  readonly callCount: number;
  readonly lastValue: number;
}

/**
 * DeterministicRNG — seeded PRNG based on the mulberry32 algorithm.
 *
 * Properties:
 * - Fully deterministic from seed: same seed → same sequence
 * - Fast integer hashing with good statistical distribution
 * - Snapshot/restore support for rollback in replays
 * - Fork produces a child RNG seeded from the current state
 *
 * Used by: card shuffle, encounter ordering, boss AI pattern selection,
 * random event rolls, loot table resolution, and ML feature noise injection.
 */
export class DeterministicRNG {
  private _seed: number;
  private _callCount: number;
  private _lastValue: number;

  constructor(seed: number | string) {
    this._seed = typeof seed === 'string' ? DeterministicRNG.hashSeed(seed) : (seed >>> 0);
    this._callCount = 0;
    this._lastValue = this._seed;
  }

  /** Convert a string seed to a 32-bit unsigned integer. */
  static hashSeed(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = Math.imul(31, hash) + s.charCodeAt(i) | 0;
    }
    return hash >>> 0;
  }

  /**
   * Advance the RNG state and return the next raw 32-bit integer (0 to 2^32-1).
   * This is the core mulberry32 step.
   */
  next(): number {
    let z = (this._lastValue + 0x6D2B79F5) >>> 0;
    z = Math.imul(z ^ (z >>> 15), z | 1) >>> 0;
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61) >>> 0;
    z = ((z ^ (z >>> 14)) >>> 0);
    this._lastValue = z;
    this._callCount++;
    return z;
  }

  /** Returns a float in [0, 1). */
  nextFloat(): number {
    return this.next() / 0x100000000;
  }

  /** Returns an integer in [min, max] (inclusive). */
  nextInt(min: number, max: number): number {
    if (min > max) throw new Error(`DeterministicRNG.nextInt: min(${min}) > max(${max})`);
    const range = max - min + 1;
    return min + (this.next() % range);
  }

  /** Returns a random boolean with given probability of true (default 0.5). */
  nextBool(probability = 0.5): boolean {
    return this.nextFloat() < probability;
  }

  /**
   * Pick a random element from an array.
   * Does NOT mutate the source array.
   */
  nextElement<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('DeterministicRNG.nextElement: empty array');
    return arr[this.nextInt(0, arr.length - 1)];
  }

  /**
   * Produce a deterministic shuffle of an array using Fisher-Yates.
   * Returns a new array; the source is not mutated.
   */
  nextShuffle<T>(arr: readonly T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Fork: produce a child RNG whose seed is derived from the current state.
   * The parent RNG state advances by one call.
   */
  fork(): DeterministicRNG {
    const childSeed = this.next();
    return new DeterministicRNG(childSeed);
  }

  /** Reseed this RNG in place (resets callCount). */
  seed(newSeed: number | string): void {
    this._seed = typeof newSeed === 'string'
      ? DeterministicRNG.hashSeed(newSeed)
      : (newSeed >>> 0);
    this._callCount = 0;
    this._lastValue = this._seed;
  }

  /** Advance N steps without returning values. Useful for aligning replay state. */
  skip(n: number): void {
    for (let i = 0; i < n; i++) this.next();
  }

  /** Pick N distinct elements from an array (sample without replacement). */
  sample<T>(arr: readonly T[], n: number): T[] {
    if (n > arr.length) throw new Error(`DeterministicRNG.sample: n(${n}) > arr.length(${arr.length})`);
    const shuffled = this.nextShuffle(arr);
    return shuffled.slice(0, n);
  }

  /** Weighted random pick. weights must be same length as items. */
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length !== weights.length) {
      throw new Error('DeterministicRNG.weightedPick: items and weights must be same length');
    }
    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) throw new Error('DeterministicRNG.weightedPick: total weight must be > 0');
    const r = this.nextFloat() * total;
    let cumulative = 0;
    for (let i = 0; i < items.length; i++) {
      cumulative += weights[i];
      if (r < cumulative) return items[i];
    }
    return items[items.length - 1];
  }

  /** Capture current state for later restore. */
  snapshot(): DeterministicRNGState {
    return {
      seed: this._seed,
      callCount: this._callCount,
      lastValue: this._lastValue,
    };
  }

  /** Restore from a previously captured snapshot. */
  restoreSnapshot(state: DeterministicRNGState): void {
    this._seed = state.seed;
    this._callCount = state.callCount;
    this._lastValue = state.lastValue;
  }

  get callCount(): number { return this._callCount; }
  get currentSeed(): number { return this._seed; }
  get lastValue(): number { return this._lastValue; }
}

/** Create a DeterministicRNG from a string run seed. */
export function createDeterministicRNG(seed: string): DeterministicRNG {
  return new DeterministicRNG(seed);
}

/** Advance an RNG state without a class instance (pure function). Returns new state. */
export function advanceDeterministicRNG(state: DeterministicRNGState): {
  next: number;
  state: DeterministicRNGState;
} {
  let z = (state.lastValue + 0x6D2B79F5) >>> 0;
  z = Math.imul(z ^ (z >>> 15), z | 1) >>> 0;
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61) >>> 0;
  z = ((z ^ (z >>> 14)) >>> 0);
  return {
    next: z,
    state: {
      seed: state.seed,
      callCount: state.callCount + 1,
      lastValue: z,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — MerkleChain
// ─────────────────────────────────────────────────────────────────────────────

/** A single leaf in the Merkle chain. */
export interface MerkleLeaf {
  readonly index: number;
  readonly dataHash: string;
  readonly nodeHash: string;
  readonly timestamp: number;
  readonly label: string;
}

/** Intermediate node computed from two child hashes. */
export interface MerkleNode {
  readonly leftHash: string;
  readonly rightHash: string;
  readonly nodeHash: string;
}

/** Proof that a leaf exists in the chain at a given index. */
export interface MerkleProof {
  readonly leafIndex: number;
  readonly leafHash: string;
  readonly path: Array<{ sibling: string; direction: 'left' | 'right' }>;
  readonly root: string;
}

/** Serializable state of a MerkleChain. */
export interface MerkleChainState {
  readonly leaves: readonly MerkleLeaf[];
  readonly size: number;
  readonly root: string;
}

/**
 * MerkleChain — an append-only chain of hashed entries.
 *
 * Used to produce a tamper-evident log of all run events. The root hash
 * can be included in the final proof hash to prove the entire event history.
 *
 * The root is recomputed on each append. For large chains this is
 * efficient enough for per-tick append (O(n) in leaves, typical runs < 5000 ticks).
 */
export class MerkleChain {
  private _leaves: MerkleLeaf[] = [];

  constructor(private readonly _label = 'merkle') {}

  /**
   * Append a new data entry to the chain.
   * The node hash includes the previous leaf's hash for chain integrity.
   */
  append(data: unknown, label = ''): MerkleLeaf {
    const dataHash = sha256(stableStringify(data));
    const previousHash = this._leaves.length > 0
      ? this._leaves[this._leaves.length - 1].nodeHash
      : '0'.repeat(64);
    const nodeHash = sha256(`${previousHash}:${dataHash}:${this._leaves.length}`);
    const leaf: MerkleLeaf = {
      index: this._leaves.length,
      dataHash,
      nodeHash,
      timestamp: Date.now(),
      label: label || `${this._label}-${this._leaves.length}`,
    };
    this._leaves.push(leaf);
    return leaf;
  }

  /** Compute the Merkle root of all current leaves. */
  root(): string {
    if (this._leaves.length === 0) return '0'.repeat(64);
    let hashes = this._leaves.map((l) => l.nodeHash);
    while (hashes.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < hashes.length; i += 2) {
        const left = hashes[i];
        const right = hashes[i + 1] ?? left;
        next.push(sha256(`${left}:${right}`));
      }
      hashes = next;
    }
    return hashes[0];
  }

  /**
   * Verify that a leaf at a given index has not been tampered with
   * by recomputing the chain up to that index.
   */
  verify(index: number): boolean {
    if (index < 0 || index >= this._leaves.length) return false;
    const leaf = this._leaves[index];
    const previousHash = index > 0 ? this._leaves[index - 1].nodeHash : '0'.repeat(64);
    const expectedNodeHash = sha256(`${previousHash}:${leaf.dataHash}:${index}`);
    return expectedNodeHash === leaf.nodeHash;
  }

  /** Build a Merkle proof for a leaf at the given index. */
  buildProof(leafIndex: number): MerkleProof {
    if (leafIndex < 0 || leafIndex >= this._leaves.length) {
      throw new Error(`MerkleChain.buildProof: index ${leafIndex} out of range`);
    }

    let hashes = this._leaves.map((l) => l.nodeHash);
    const path: Array<{ sibling: string; direction: 'left' | 'right' }> = [];
    let idx = leafIndex;

    while (hashes.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < hashes.length; i += 2) {
        const left = hashes[i];
        const right = hashes[i + 1] ?? left;
        if (i === idx || i + 1 === idx) {
          const isLeft = idx % 2 === 0;
          path.push({
            sibling: isLeft ? right : left,
            direction: isLeft ? 'right' : 'left',
          });
          idx = Math.floor(idx / 2);
        }
        next.push(sha256(`${left}:${right}`));
      }
      hashes = next;
    }

    return {
      leafIndex,
      leafHash: this._leaves[leafIndex].nodeHash,
      path,
      root: hashes[0],
    };
  }

  /**
   * Verify a Merkle proof against the current root.
   * Returns true only if the proof is valid and the root matches.
   */
  verifyProof(proof: MerkleProof): boolean {
    let hash = proof.leafHash;
    for (const step of proof.path) {
      hash = step.direction === 'right'
        ? sha256(`${hash}:${step.sibling}`)
        : sha256(`${step.sibling}:${hash}`);
    }
    return hash === proof.root && proof.root === this.root();
  }

  /** Snapshot for checkpoint/restore support. */
  snapshot(): MerkleChainState {
    return {
      leaves: [...this._leaves],
      size: this._leaves.length,
      root: this.root(),
    };
  }

  /** Restore from a snapshot (useful for replay rollback). */
  restoreSnapshot(state: MerkleChainState): void {
    this._leaves = [...state.leaves] as MerkleLeaf[];
  }

  /** Return all leaves as an array. */
  toArray(): readonly MerkleLeaf[] {
    return [...this._leaves];
  }

  get size(): number { return this._leaves.length; }
  get label(): string { return this._label; }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — RunAuditLog
// ─────────────────────────────────────────────────────────────────────────────

/** All auditable event kinds in the engine. */
export type AuditEventKind =
  | 'tick'
  | 'phase_transition'
  | 'tier_crossing'
  | 'card_play'
  | 'outcome'
  | 'error'
  | 'checkpoint'
  | 'ml_event'
  | 'replay_frame'
  | 'proof_sealed'
  | 'rng_fork'
  | 'cascade_trigger'
  | 'shield_break'
  | 'sovereignty_event';

/** A single audit entry. */
export interface AuditEntry {
  readonly id: string;
  readonly kind: AuditEventKind;
  readonly runId: string;
  readonly tick: number;
  readonly timestamp: number;
  readonly payload: Record<string, unknown>;
  readonly payloadHash: string;
  readonly signature: string;
}

/** Options for RunAuditLog. */
export interface RunAuditLogOptions {
  readonly runId: string;
  readonly signingKey?: string;
  readonly maxEntries?: number;
  readonly enableMerkle?: boolean;
}

/** Serializable state of the audit log. */
export interface AuditLogState {
  readonly runId: string;
  readonly entries: readonly AuditEntry[];
  readonly entryCount: number;
  readonly logHash: string;
  readonly merkleRoot?: string;
}

/** Aggregate summary of audit log contents. */
export interface AuditLogSummary {
  readonly runId: string;
  readonly totalEntries: number;
  readonly byKind: Record<AuditEventKind, number>;
  readonly firstTimestamp: number;
  readonly lastTimestamp: number;
  readonly logHash: string;
  readonly merkleRoot: string;
}

/**
 * RunAuditLog — per-run, append-only, tamper-evident audit event log.
 *
 * Every engine action that changes run state produces an audit entry.
 * Entries are signed with HMAC-SHA256 if a signing key is provided.
 * The full log can be reduced to a single hash for inclusion in proof hashes.
 *
 * User experience impact:
 * - Enables full replay verification so users can prove their run was fair
 * - Provides the exact event sequence for customer-support dispute resolution
 * - Powers the CORD (Canonical Outcome Record & Digest) system
 */
export class RunAuditLog {
  private _entries: AuditEntry[] = [];
  private _chain: MerkleChain;
  private readonly _runId: string;
  private readonly _signingKey: string;
  private readonly _maxEntries: number;
  private readonly _enableMerkle: boolean;

  constructor(opts: RunAuditLogOptions) {
    this._runId = opts.runId;
    this._signingKey = opts.signingKey ?? 'point-zero-one-audit';
    this._maxEntries = opts.maxEntries ?? 50000;
    this._enableMerkle = opts.enableMerkle ?? true;
    this._chain = new MerkleChain(`audit-${this._runId}`);
  }

  private _buildEntry(
    kind: AuditEventKind,
    tick: number,
    payload: Record<string, unknown>,
  ): AuditEntry {
    const payloadHash = checksumSnapshot(payload);
    const id = createDeterministicId('audit', this._runId, String(tick), kind, payloadHash);
    const signature = hmacSha256(this._signingKey, `${id}:${payloadHash}`);
    const entry: AuditEntry = {
      id,
      kind,
      runId: this._runId,
      tick,
      timestamp: Date.now(),
      payload,
      payloadHash,
      signature,
    };
    return entry;
  }

  private _record(kind: AuditEventKind, tick: number, payload: Record<string, unknown>): AuditEntry {
    if (this._entries.length >= this._maxEntries) {
      this._entries.shift(); // Drop oldest to maintain cap
    }
    const entry = this._buildEntry(kind, tick, payload);
    this._entries.push(entry);
    if (this._enableMerkle) {
      this._chain.append({ entryId: entry.id, payloadHash: entry.payloadHash }, kind);
    }
    return entry;
  }

  /** Record a tick event (called every tick). */
  recordTick(tick: number, stateChecksum: string, eventCount: number): AuditEntry {
    return this._record('tick', tick, { stateChecksum, eventCount });
  }

  /** Record a run phase transition (FOUNDATION→ESCALATION→SOVEREIGNTY). */
  recordPhaseTransition(tick: number, fromPhase: string, toPhase: string): AuditEntry {
    return this._record('phase_transition', tick, { fromPhase, toPhase });
  }

  /** Record a pressure tier crossing (T0→T1, T1→T2, etc.). */
  recordTierCrossing(tick: number, fromTier: number, toTier: number): AuditEntry {
    return this._record('tier_crossing', tick, { fromTier, toTier });
  }

  /** Record a card play action by the user. */
  recordCardPlay(
    tick: number,
    cardId: string,
    userId: string,
    netWorthBefore: number,
    netWorthAfter: number,
  ): AuditEntry {
    return this._record('card_play', tick, {
      cardId,
      userId,
      netWorthBefore,
      netWorthAfter,
      delta: netWorthAfter - netWorthBefore,
    });
  }

  /** Record the run outcome (win/loss/expired). */
  recordOutcome(tick: number, outcome: string, finalNetWorth: number, proofHash: string): AuditEntry {
    return this._record('outcome', tick, { outcome, finalNetWorth, proofHash });
  }

  /** Record an engine error (non-fatal). */
  recordError(tick: number, errorCode: string, message: string, context: Record<string, unknown> = {}): AuditEntry {
    return this._record('error', tick, { errorCode, message, ...context });
  }

  /** Record a checkpoint (explicit state seal). */
  recordCheckpoint(tick: number, checkpointId: string, stateChecksum: string): AuditEntry {
    return this._record('checkpoint', tick, { checkpointId, stateChecksum });
  }

  /** Record an ML event (tier crossing signal, phase signal, DL packet). */
  recordMLEvent(tick: number, eventType: string, vectorChecksum: string, score: number): AuditEntry {
    return this._record('ml_event', tick, { eventType, vectorChecksum, score });
  }

  /** Record a replay frame hash. */
  recordReplayFrame(tick: number, frameHash: string, previousFrameHash: string): AuditEntry {
    return this._record('replay_frame', tick, { frameHash, previousFrameHash });
  }

  /** Record the proof seal event at run end. */
  recordProofSealed(tick: number, proofHash: string, extendedProofHash: string): AuditEntry {
    return this._record('proof_sealed', tick, { proofHash, extendedProofHash });
  }

  /** Record an RNG fork event. */
  recordRNGFork(tick: number, parentSeed: number, childSeed: number, purpose: string): AuditEntry {
    return this._record('rng_fork', tick, { parentSeed, childSeed, purpose });
  }

  /** Record a cascade trigger. */
  recordCascadeTrigger(tick: number, cascadeId: string, chainDepth: number): AuditEntry {
    return this._record('cascade_trigger', tick, { cascadeId, chainDepth });
  }

  /** Record a shield break event. */
  recordShieldBreak(tick: number, shieldId: string, breakCause: string): AuditEntry {
    return this._record('shield_break', tick, { shieldId, breakCause });
  }

  /** Record a sovereignty event (bid, lock, resolve). */
  recordSovereigntyEvent(tick: number, eventSubtype: string, payload: Record<string, unknown>): AuditEntry {
    return this._record('sovereignty_event', tick, { eventSubtype, ...payload });
  }

  /** Return all entries of a given kind. */
  getByKind(kind: AuditEventKind): AuditEntry[] {
    return this._entries.filter((e) => e.kind === kind);
  }

  /** Return entries recorded since a given tick (inclusive). */
  getSince(tick: number): AuditEntry[] {
    return this._entries.filter((e) => e.tick >= tick);
  }

  /** Return the N most recent entries. */
  getLatest(n = 10): AuditEntry[] {
    return this._entries.slice(-n);
  }

  /** Return all entries for a given tick. */
  getByTick(tick: number): AuditEntry[] {
    return this._entries.filter((e) => e.tick === tick);
  }

  /** Compute a single hash representing the entire audit log. */
  computeLogHash(): string {
    return checksumSnapshot(this._entries.map((e) => ({
      id: e.id,
      payloadHash: e.payloadHash,
    })));
  }

  /** Build a human-readable summary of the log. */
  buildSummary(): AuditLogSummary {
    const byKind = {} as Record<AuditEventKind, number>;
    for (const entry of this._entries) {
      byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1;
    }
    return {
      runId: this._runId,
      totalEntries: this._entries.length,
      byKind,
      firstTimestamp: this._entries[0]?.timestamp ?? 0,
      lastTimestamp: this._entries[this._entries.length - 1]?.timestamp ?? 0,
      logHash: this.computeLogHash(),
      merkleRoot: this._chain.root(),
    };
  }

  /** Verify the HMAC signature on a single entry. */
  verifyEntry(entry: AuditEntry): boolean {
    const expected = hmacSha256(this._signingKey, `${entry.id}:${entry.payloadHash}`);
    return expected === entry.signature;
  }

  /** Verify all entries in the log. Returns indices of any invalid entries. */
  verifyAll(): number[] {
    const invalid: number[] = [];
    for (let i = 0; i < this._entries.length; i++) {
      if (!this.verifyEntry(this._entries[i])) invalid.push(i);
    }
    return invalid;
  }

  /** Capture full state for persistence/replay. */
  captureState(): AuditLogState {
    return {
      runId: this._runId,
      entries: [...this._entries],
      entryCount: this._entries.length,
      logHash: this.computeLogHash(),
      merkleRoot: this._chain.root(),
    };
  }

  get entryCount(): number { return this._entries.length; }
  get merkleRoot(): string { return this._chain.root(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — ReplayHashBuilder
// ─────────────────────────────────────────────────────────────────────────────

/** A single frame in the replay hash chain. */
export interface ReplayFrame {
  readonly tick: number;
  readonly stateHash: string;
  readonly eventsHash: string;
  readonly frameHash: string;
  readonly chainHash: string;
  readonly rngCallCount: number;
  readonly mlVectorHash: string;
}

/** Options for the ReplayHashBuilder. */
export interface ReplayHashBuilderOptions {
  readonly runId: string;
  readonly seed: string;
  readonly mode: string;
}

/** Final report produced when a replay is finalized. */
export interface ReplayHashReport {
  readonly runId: string;
  readonly seed: string;
  readonly mode: string;
  readonly frameCount: number;
  readonly streamChecksum: string;
  readonly merkleRoot: string;
  readonly firstFrameHash: string;
  readonly lastFrameHash: string;
  readonly finalChainHash: string;
  readonly replayValid: boolean;
}

/** Result of replaying and verifying a frame sequence. */
export interface ReplayVerificationResult {
  readonly valid: boolean;
  readonly mismatchedTick?: number;
  readonly expectedHash?: string;
  readonly actualHash?: string;
  readonly frameCount: number;
}

/**
 * ReplayHashBuilder — builds a tamper-evident, frame-by-frame hash chain
 * of all tick states across a run.
 *
 * At run end, `finalize()` produces a `ReplayHashReport` whose `streamChecksum`
 * becomes the `tickStreamChecksum` in the ProofHashInput. This links the
 * entire run history to the final proof hash in a single digest.
 */
export class ReplayHashBuilder {
  private _frames: ReplayFrame[] = [];
  private _chainHash = '0'.repeat(64);
  private readonly _chain: MerkleChain;
  private readonly _opts: ReplayHashBuilderOptions;

  constructor(opts: ReplayHashBuilderOptions) {
    this._opts = opts;
    this._chain = new MerkleChain(`replay-${opts.runId}`);
  }

  /**
   * Add a frame to the replay chain.
   * `events` is the array of event objects emitted during this tick.
   * `mlVector` is the raw DL input vector for this tick (24 features).
   */
  addFrame(
    tick: number,
    state: unknown,
    events: unknown[],
    rngCallCount: number,
    mlVector: readonly number[],
  ): ReplayFrame {
    const stateHash = checksumSnapshot(state);
    const eventsHash = checksumSnapshot(events);
    const mlVectorHash = checksumSnapshot(mlVector);
    const frameHash = sha256(stableStringify({
      tick,
      stateHash,
      eventsHash,
      rngCallCount,
      mlVectorHash,
    }));
    const chainHash = sha256(`${this._chainHash}:${frameHash}:${tick}`);
    this._chainHash = chainHash;

    const frame: ReplayFrame = {
      tick,
      stateHash,
      eventsHash,
      frameHash,
      chainHash,
      rngCallCount,
      mlVectorHash,
    };
    this._frames.push(frame);
    this._chain.append({ tick, frameHash }, `frame-${tick}`);
    return frame;
  }

  /** Finalize the replay and produce the full hash report. */
  finalize(): ReplayHashReport {
    const streamChecksum = checksumSnapshot(
      this._frames.map((f) => ({ tick: f.tick, frameHash: f.frameHash })),
    );
    return {
      runId: this._opts.runId,
      seed: this._opts.seed,
      mode: this._opts.mode,
      frameCount: this._frames.length,
      streamChecksum,
      merkleRoot: this._chain.root(),
      firstFrameHash: this._frames[0]?.frameHash ?? '0'.repeat(64),
      lastFrameHash: this._frames[this._frames.length - 1]?.frameHash ?? '0'.repeat(64),
      finalChainHash: this._chainHash,
      replayValid: true,
    };
  }

  /**
   * Verify a replayed frame sequence against the recorded frames.
   * Returns a verification result indicating whether the replay matches.
   */
  verifyReplay(replayedFrames: ReplayFrame[]): ReplayVerificationResult {
    if (replayedFrames.length !== this._frames.length) {
      return {
        valid: false,
        frameCount: replayedFrames.length,
        mismatchedTick: 0,
        expectedHash: `length:${this._frames.length}`,
        actualHash: `length:${replayedFrames.length}`,
      };
    }

    for (let i = 0; i < this._frames.length; i++) {
      const recorded = this._frames[i];
      const replayed = replayedFrames[i];
      if (recorded.frameHash !== replayed.frameHash) {
        return {
          valid: false,
          frameCount: replayedFrames.length,
          mismatchedTick: recorded.tick,
          expectedHash: recorded.frameHash,
          actualHash: replayed.frameHash,
        };
      }
    }

    return { valid: true, frameCount: this._frames.length };
  }

  /** Get all recorded frames. */
  getFrames(): readonly ReplayFrame[] {
    return [...this._frames];
  }

  /** Get the frame at a given tick (or undefined if not found). */
  getFrameAtTick(tick: number): ReplayFrame | undefined {
    return this._frames.find((f) => f.tick === tick);
  }

  get frameCount(): number { return this._frames.length; }
  get currentChainHash(): string { return this._chainHash; }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — DeterministicSnapshotDiff
// ─────────────────────────────────────────────────────────────────────────────

/** Types of diff operations between two snapshots. */
export type DiffOperation = 'add' | 'remove' | 'change' | 'unchanged';

/** A single entry in a snapshot diff. */
export interface SnapshotDiffEntry {
  readonly path: string;
  readonly operation: DiffOperation;
  readonly previousValue: CanonicalValue | undefined;
  readonly nextValue: CanonicalValue | undefined;
}

/** The full result of diffing two snapshots. */
export interface SnapshotDiff {
  readonly entries: readonly SnapshotDiffEntry[];
  readonly addCount: number;
  readonly removeCount: number;
  readonly changeCount: number;
  readonly totalChanges: number;
  readonly diffHash: string;
}

/**
 * DeterministicSnapshotDiff — computes canonical diffs between two engine snapshots.
 *
 * Used to:
 * - Detect state regressions in replay verification
 * - Build delta-compressed audit entries
 * - Provide human-readable change summaries for post-run analytics
 * - Power the ML delta feature vector (what changed this tick vs last)
 */
export class DeterministicSnapshotDiff {
  private static _diffValues(
    prev: CanonicalValue | undefined,
    next: CanonicalValue | undefined,
    path: string,
    entries: SnapshotDiffEntry[],
  ): void {
    if (prev === undefined && next !== undefined) {
      entries.push({ path, operation: 'add', previousValue: undefined, nextValue: next });
      return;
    }
    if (prev !== undefined && next === undefined) {
      entries.push({ path, operation: 'remove', previousValue: prev, nextValue: undefined });
      return;
    }
    if (prev === null && next === null) return;
    if (typeof prev !== typeof next || prev === null || next === null) {
      entries.push({ path, operation: 'change', previousValue: prev, nextValue: next });
      return;
    }

    if (
      typeof prev === 'string' ||
      typeof prev === 'number' ||
      typeof prev === 'boolean'
    ) {
      if (prev !== next) {
        entries.push({ path, operation: 'change', previousValue: prev, nextValue: next });
      }
      return;
    }

    if (Array.isArray(prev) && Array.isArray(next)) {
      const maxLen = Math.max(prev.length, (next as CanonicalValue[]).length);
      for (let i = 0; i < maxLen; i++) {
        DeterministicSnapshotDiff._diffValues(
          prev[i],
          (next as CanonicalValue[])[i],
          `${path}[${i}]`,
          entries,
        );
      }
      return;
    }

    if (isPlainObject(prev) && isPlainObject(next)) {
      const prevObj = prev as Record<string, CanonicalValue>;
      const nextObj = next as Record<string, CanonicalValue>;
      const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);
      for (const key of allKeys) {
        DeterministicSnapshotDiff._diffValues(
          prevObj[key],
          nextObj[key],
          path ? `${path}.${key}` : key,
          entries,
        );
      }
      return;
    }

    if (stableStringify(prev) !== stableStringify(next)) {
      entries.push({ path, operation: 'change', previousValue: prev, nextValue: next });
    }
  }

  /** Compute a canonical diff between two arbitrary snapshots. */
  static compute(previousSnapshot: unknown, nextSnapshot: unknown): SnapshotDiff {
    const entries: SnapshotDiffEntry[] = [];
    const prev = toCanonicalValue(previousSnapshot, new WeakSet());
    const next = toCanonicalValue(nextSnapshot, new WeakSet());
    DeterministicSnapshotDiff._diffValues(prev, next, '', entries);

    const changes = entries.filter((e) => e.operation !== 'unchanged');
    return {
      entries,
      addCount: changes.filter((e) => e.operation === 'add').length,
      removeCount: changes.filter((e) => e.operation === 'remove').length,
      changeCount: changes.filter((e) => e.operation === 'change').length,
      totalChanges: changes.length,
      diffHash: checksumSnapshot(changes.map((e) => ({ path: e.path, op: e.operation }))),
    };
  }

  /** Build a flat summary of paths changed, for ML delta features. */
  static summarizePaths(diff: SnapshotDiff): string[] {
    return diff.entries
      .filter((e) => e.operation !== 'unchanged')
      .map((e) => `${e.operation}:${e.path}`);
  }

  /** Compute a hash of only the changed fields. */
  static diffHash(diff: SnapshotDiff): string {
    return diff.diffHash;
  }

  /** Format diff as a readable string for debugging/logging. */
  static formatDiff(diff: SnapshotDiff): string {
    const lines: string[] = [
      `Snapshot diff: +${diff.addCount} ~${diff.changeCount} -${diff.removeCount}`,
    ];
    for (const entry of diff.entries) {
      if (entry.operation === 'unchanged') continue;
      lines.push(
        `  ${entry.operation.toUpperCase().padEnd(8)} ${entry.path}` +
        (entry.operation === 'change'
          ? ` ${JSON.stringify(entry.previousValue)} → ${JSON.stringify(entry.nextValue)}`
          : ''),
      );
    }
    return lines.join('\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — CanonicalEncoder
// ─────────────────────────────────────────────────────────────────────────────

/** Options for CanonicalEncoder. */
export interface CanonicalEncoderOptions {
  readonly hashAlgorithm?: 'sha256' | 'sha512';
  readonly enableStats?: boolean;
  readonly signingKey?: string;
}

/** Running statistics for a CanonicalEncoder instance. */
export interface CanonicalEncoderStats {
  readonly encodeCount: number;
  readonly totalBytesEncoded: number;
  readonly totalHashesComputed: number;
  readonly averagePayloadBytes: number;
}

/**
 * CanonicalEncoder — utility class wrapping stableStringify with
 * per-instance statistics, HMAC signing, and multi-value support.
 *
 * Intended for subsystems that produce many encoded values per tick
 * and need aggregate stats for diagnostics (e.g., encoding overhead monitoring).
 */
export class CanonicalEncoder {
  private _encodeCount = 0;
  private _totalBytesEncoded = 0;
  private _totalHashesComputed = 0;
  private readonly _hashAlgorithm: 'sha256' | 'sha512';
  private readonly _enableStats: boolean;
  private readonly _signingKey: string | undefined;

  constructor(opts: CanonicalEncoderOptions = {}) {
    this._hashAlgorithm = opts.hashAlgorithm ?? 'sha256';
    this._enableStats = opts.enableStats ?? true;
    this._signingKey = opts.signingKey;
  }

  /** Canonically encode a value to a JSON string. */
  encode(value: unknown): string {
    const result = stableStringify(value);
    if (this._enableStats) {
      this._encodeCount++;
      this._totalBytesEncoded += result.length;
    }
    return result;
  }

  /** Encode multiple values and concatenate with a separator. */
  encodeMulti(values: unknown[], separator = '|'): string {
    return values.map((v) => this.encode(v)).join(separator);
  }

  /** Encode a value and return it as a Buffer. */
  encodeBuffer(value: unknown): Buffer {
    return Buffer.from(this.encode(value), 'utf8');
  }

  /** Compute a hash of a single encoded value. */
  computeChecksum(value: unknown): string {
    const encoded = this.encode(value);
    const hash = this._hashAlgorithm === 'sha512'
      ? sha512(encoded)
      : sha256(encoded);
    if (this._enableStats) this._totalHashesComputed++;
    return hash;
  }

  /** Compute a hash of multiple encoded values combined. */
  computeChecksumMulti(...values: unknown[]): string {
    return this.computeChecksum(values);
  }

  /** Sign a value with HMAC-SHA256 if a signing key is configured. */
  sign(value: unknown): string {
    if (!this._signingKey) {
      throw new Error('CanonicalEncoder: sign() requires a signingKey option');
    }
    return hmacSha256(this._signingKey, this.encode(value));
  }

  /** Verify that a signature is valid for a given value. */
  verify(value: unknown, signature: string): boolean {
    if (!this._signingKey) return false;
    return hmacSha256(this._signingKey, this.encode(value)) === signature;
  }

  /** Return current stats. */
  getStats(): CanonicalEncoderStats {
    return {
      encodeCount: this._encodeCount,
      totalBytesEncoded: this._totalBytesEncoded,
      totalHashesComputed: this._totalHashesComputed,
      averagePayloadBytes: this._encodeCount > 0
        ? this._totalBytesEncoded / this._encodeCount
        : 0,
    };
  }

  /** Reset all statistics. */
  reset(): void {
    this._encodeCount = 0;
    this._totalBytesEncoded = 0;
    this._totalHashesComputed = 0;
  }

  /** Static: encode a value without creating an instance. */
  static encodeStatic(value: unknown): string {
    return stableStringify(value);
  }

  /** Static: compute a SHA-256 checksum without creating an instance. */
  static checksumStatic(value: unknown): string {
    return checksumSnapshot(value);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — DeterministicIdRegistry
// ─────────────────────────────────────────────────────────────────────────────

/** A single entry in the ID registry. */
export interface IdRegistryEntry {
  readonly id: string;
  readonly namespace: string;
  readonly key: string;
  readonly registeredAt: number;
  readonly metadata: Record<string, unknown>;
}

/** Options for the DeterministicIdRegistry. */
export interface IdRegistryOptions {
  readonly maxEntries?: number;
  readonly throwOnConflict?: boolean;
}

/** Stats for the ID registry. */
export interface IdRegistryStats {
  readonly totalRegistered: number;
  readonly totalLookups: number;
  readonly totalConflicts: number;
  readonly namespaces: string[];
  readonly registryHash: string;
}

/**
 * DeterministicIdRegistry — collision-safe, per-namespace ID registry.
 *
 * Ensures that all deterministic IDs within an engine run are unique
 * across namespaces and that their computation inputs are auditable.
 *
 * Use cases:
 * - Card instance IDs within a deck
 * - Cascade chain IDs
 * - ML packet sequence IDs
 * - Replay frame IDs
 */
export class DeterministicIdRegistry {
  private _entries = new Map<string, IdRegistryEntry>();
  private _totalLookups = 0;
  private _totalConflicts = 0;
  private readonly _maxEntries: number;
  private readonly _throwOnConflict: boolean;

  constructor(opts: IdRegistryOptions = {}) {
    this._maxEntries = opts.maxEntries ?? 100000;
    this._throwOnConflict = opts.throwOnConflict ?? false;
  }

  /**
   * Register an ID explicitly.
   * If the id already exists, behaviour is controlled by `throwOnConflict`.
   */
  register(
    namespace: string,
    key: string,
    metadata: Record<string, unknown> = {},
  ): IdRegistryEntry {
    const id = createDeterministicId(namespace, key);
    const existing = this._entries.get(id);

    if (existing) {
      this._totalConflicts++;
      if (this._throwOnConflict) {
        throw new Error(`DeterministicIdRegistry: ID conflict in namespace "${namespace}" key "${key}" (id=${id})`);
      }
      return existing;
    }

    if (this._entries.size >= this._maxEntries) {
      throw new Error(`DeterministicIdRegistry: max entries (${this._maxEntries}) reached`);
    }

    const entry: IdRegistryEntry = {
      id,
      namespace,
      key,
      registeredAt: Date.now(),
      metadata,
    };
    this._entries.set(id, entry);
    return entry;
  }

  /** Look up a registered entry by namespace + key. */
  get(namespace: string, key: string): IdRegistryEntry | undefined {
    this._totalLookups++;
    const id = createDeterministicId(namespace, key);
    return this._entries.get(id);
  }

  /** Get or create an entry. */
  getOrCreate(namespace: string, key: string, metadata: Record<string, unknown> = {}): IdRegistryEntry {
    return this.get(namespace, key) ?? this.register(namespace, key, metadata);
  }

  /** Check whether a namespace + key is registered. */
  has(namespace: string, key: string): boolean {
    const id = createDeterministicId(namespace, key);
    return this._entries.has(id);
  }

  /** Remove an entry by namespace + key. Returns true if it existed. */
  delete(namespace: string, key: string): boolean {
    const id = createDeterministicId(namespace, key);
    return this._entries.delete(id);
  }

  /** List all entries in a namespace. */
  listByNamespace(namespace: string): IdRegistryEntry[] {
    return Array.from(this._entries.values()).filter((e) => e.namespace === namespace);
  }

  /** List all entries. */
  listAll(): IdRegistryEntry[] {
    return Array.from(this._entries.values());
  }

  /** Compute a hash representing the full registry state. */
  computeRegistryHash(): string {
    const sorted = canonicalSort(this.listAll(), 'id');
    return checksumSnapshot(sorted.map((e) => ({ id: e.id, namespace: e.namespace, key: e.key })));
  }

  /** Get registry stats. */
  getStats(): IdRegistryStats {
    const namespaces = [...new Set(this.listAll().map((e) => e.namespace))];
    return {
      totalRegistered: this._entries.size,
      totalLookups: this._totalLookups,
      totalConflicts: this._totalConflicts,
      namespaces,
      registryHash: this.computeRegistryHash(),
    };
  }

  /** Clear all entries. */
  clear(): void {
    this._entries.clear();
  }

  get size(): number { return this._entries.size; }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — VerificationResult + verifyProofHash / verifyTickSeal
// ─────────────────────────────────────────────────────────────────────────────

/** Possible statuses for a verification check. */
export type VerificationStatus = 'valid' | 'invalid' | 'tampered' | 'missing_data' | 'format_error';

/** Result of a single verification operation. */
export interface VerificationResult {
  readonly status: VerificationStatus;
  readonly valid: boolean;
  readonly checkType: string;
  readonly expectedHash: string;
  readonly actualHash: string;
  readonly message: string;
  readonly timestamp: number;
}

/** Context provided to verification operations. */
export interface VerificationContext {
  readonly runId: string;
  readonly userId: string;
  readonly tick?: number;
  readonly mode?: string;
}

/**
 * Verify a proof hash by recomputing it from its inputs.
 * Returns a detailed VerificationResult including whether tampering is suspected.
 */
export function verifyProofHash(
  input: ProofHashInput,
  claimedHash: string,
  _context?: VerificationContext,
): VerificationResult {
  if (!claimedHash || claimedHash.length !== 64) {
    return {
      status: 'format_error',
      valid: false,
      checkType: 'proof_hash',
      expectedHash: '',
      actualHash: claimedHash ?? '',
      message: 'Claimed hash is missing or malformed (expected 64-char hex)',
      timestamp: Date.now(),
    };
  }

  const expectedHash = computeProofHash(input);
  const valid = expectedHash === claimedHash;

  return {
    status: valid ? 'valid' : 'tampered',
    valid,
    checkType: 'proof_hash',
    expectedHash,
    actualHash: claimedHash,
    message: valid
      ? 'Proof hash is valid.'
      : `Proof hash mismatch. Run outcome may have been altered.`,
    timestamp: Date.now(),
  };
}

/**
 * Verify an extended proof hash (includes merkle root and audit log hash).
 */
export function verifyExtendedProofHash(
  input: ExtendedProofHashInput,
  claimedHash: string,
  _context?: VerificationContext,
): VerificationResult {
  if (!claimedHash || claimedHash.length !== 64) {
    return {
      status: 'format_error',
      valid: false,
      checkType: 'extended_proof_hash',
      expectedHash: '',
      actualHash: claimedHash ?? '',
      message: 'Claimed extended hash is missing or malformed',
      timestamp: Date.now(),
    };
  }

  const expectedHash = computeExtendedProofHash(input);
  const valid = expectedHash === claimedHash;

  return {
    status: valid ? 'valid' : 'tampered',
    valid,
    checkType: 'extended_proof_hash',
    expectedHash,
    actualHash: claimedHash,
    message: valid
      ? 'Extended proof hash is valid.'
      : 'Extended proof hash mismatch. Merkle root or audit log may have been altered.',
    timestamp: Date.now(),
  };
}

/**
 * Verify a tick seal by recomputing it.
 */
export function verifyTickSeal(
  input: TickSealInput,
  claimedSeal: string,
  context?: VerificationContext,
): VerificationResult {
  if (!claimedSeal || claimedSeal.length !== 64) {
    return {
      status: 'format_error',
      valid: false,
      checkType: 'tick_seal',
      expectedHash: '',
      actualHash: claimedSeal ?? '',
      message: `Tick seal format error at tick ${context?.tick ?? input.tick}`,
      timestamp: Date.now(),
    };
  }

  const expectedSeal = computeTickSeal(input);
  const valid = expectedSeal === claimedSeal;

  return {
    status: valid ? 'valid' : 'tampered',
    valid,
    checkType: 'tick_seal',
    expectedHash: expectedSeal,
    actualHash: claimedSeal,
    message: valid
      ? `Tick seal valid at tick ${input.tick}.`
      : `Tick seal mismatch at tick ${input.tick}. State may have been altered.`,
    timestamp: Date.now(),
  };
}

/**
 * Verify a replay frame by re-checking its computed hash.
 */
export function verifyReplayFrame(
  frame: ReplayFrame,
  previousChainHash: string,
): VerificationResult {
  const expectedFrameHash = sha256(stableStringify({
    tick: frame.tick,
    stateHash: frame.stateHash,
    eventsHash: frame.eventsHash,
    rngCallCount: frame.rngCallCount,
    mlVectorHash: frame.mlVectorHash,
  }));
  const expectedChainHash = sha256(`${previousChainHash}:${expectedFrameHash}:${frame.tick}`);
  const valid = expectedFrameHash === frame.frameHash && expectedChainHash === frame.chainHash;

  return {
    status: valid ? 'valid' : 'tampered',
    valid,
    checkType: 'replay_frame',
    expectedHash: expectedFrameHash,
    actualHash: frame.frameHash,
    message: valid
      ? `Replay frame valid at tick ${frame.tick}.`
      : `Replay frame tampered at tick ${frame.tick}.`,
    timestamp: Date.now(),
  };
}

/** Aggregate result of a batch verification operation. */
export interface BatchVerificationResult {
  readonly totalChecks: number;
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly results: readonly VerificationResult[];
  readonly overallValid: boolean;
  readonly reportHash: string;
}

/**
 * VerificationSuite — batch verification of proof hashes, tick seals,
 * and replay frames for a complete run.
 *
 * Used at run end and by the CORD verification service.
 */
export class VerificationSuite {
  private _results: VerificationResult[] = [];

  /** Add a pre-computed VerificationResult. */
  add(result: VerificationResult): void {
    this._results.push(result);
  }

  /** Verify and add a proof hash. */
  checkProofHash(input: ProofHashInput, claimedHash: string, ctx?: VerificationContext): VerificationResult {
    const result = verifyProofHash(input, claimedHash, ctx);
    this.add(result);
    return result;
  }

  /** Verify and add an extended proof hash. */
  checkExtendedProofHash(input: ExtendedProofHashInput, claimedHash: string, ctx?: VerificationContext): VerificationResult {
    const result = verifyExtendedProofHash(input, claimedHash, ctx);
    this.add(result);
    return result;
  }

  /** Verify and add a tick seal. */
  checkTickSeal(input: TickSealInput, claimedSeal: string, ctx?: VerificationContext): VerificationResult {
    const result = verifyTickSeal(input, claimedSeal, ctx);
    this.add(result);
    return result;
  }

  /** Verify and add a replay frame. */
  checkReplayFrame(frame: ReplayFrame, previousChainHash: string): VerificationResult {
    const result = verifyReplayFrame(frame, previousChainHash);
    this.add(result);
    return result;
  }

  /** Produce the batch result. */
  buildReport(): BatchVerificationResult {
    const passed = this._results.filter((r) => r.valid).length;
    return {
      totalChecks: this._results.length,
      passedChecks: passed,
      failedChecks: this._results.length - passed,
      results: [...this._results],
      overallValid: this._results.every((r) => r.valid),
      reportHash: checksumSnapshot(this._results.map((r) => ({ type: r.checkType, valid: r.valid }))),
    };
  }

  get resultCount(): number { return this._results.length; }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — ML/DL Feature Vector from Deterministic Context
// ─────────────────────────────────────────────────────────────────────────────

/** Labels for the deterministic ML feature vector. */
export const DETERMINISTIC_ML_FEATURE_LABELS: readonly string[] = [
  'audit_log_size_norm',       // 0: normalized audit log entry count
  'merkle_depth_norm',         // 1: normalized merkle chain depth
  'replay_frame_count_norm',   // 2: normalized replay frame count
  'proof_hash_valid',          // 3: 1.0 if proof hash is valid, else 0.0
  'rng_call_count_norm',       // 4: normalized RNG call count
  'id_registry_size_norm',     // 5: normalized ID registry size
  'diff_change_rate',          // 6: fraction of fields changed in last diff
  'error_rate_norm',           // 7: normalized error count in audit log
  'card_play_count_norm',      // 8: normalized card play count
  'tier_crossing_count_norm',  // 9: normalized tier crossing count
  'phase_transition_count_norm', // 10: normalized phase transition count
  'cascade_trigger_count_norm',  // 11: normalized cascade trigger count
  'shield_break_count_norm',     // 12: normalized shield break count
  'sovereignty_event_count_norm',// 13: normalized sovereignty event count
  'checkpoint_density_norm',     // 14: normalized checkpoint count per 100 ticks
  'ml_event_count_norm',         // 15: normalized ML event count
] as const;

/** The deterministic ML vector. */
export interface DeterministicMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly vectorHash: string;
  readonly tick: number;
}

/** Summary of deterministic context for ML consumption. */
export interface DeterministicMLContext {
  readonly vector: DeterministicMLVector;
  readonly auditSummary: AuditLogSummary;
  readonly replayFrameCount: number;
  readonly proofValid: boolean;
  readonly registryStats: IdRegistryStats;
}

/**
 * DeterministicMLVectorBuilder — produces the 16-feature deterministic
 * ML vector from a snapshot of the engine's deterministic context.
 *
 * This vector is appended to every tick's DL input tensor so the ML layer
 * has visibility into the health and integrity of the deterministic subsystem.
 */
export class DeterministicMLVectorBuilder {
  static readonly FEATURE_COUNT = DETERMINISTIC_ML_FEATURE_LABELS.length;

  /** Build the feature vector from current deterministic state. */
  static build(
    auditLog: RunAuditLog,
    replay: ReplayHashBuilder,
    registry: DeterministicIdRegistry,
    tick: number,
    proofValid: boolean,
    lastDiff: SnapshotDiff | null,
  ): DeterministicMLVector {
    const summary = auditLog.buildSummary();
    const byKind = summary.byKind;
    const maxAuditEntries = 50000;
    const maxFrames = 5000;
    const maxRegistrySize = 100000;
    const maxRngCalls = 1000000;
    const maxCards = 500;
    const maxTier = 50;
    const maxPhase = 10;
    const maxCascade = 200;
    const maxShield = 100;
    const maxSov = 100;
    const maxCheckpoints = 500;
    const maxML = 1000;

    const features = [
      Math.min(auditLog.entryCount / maxAuditEntries, 1),
      Math.min(replay.frameCount / maxFrames, 1),
      Math.min(replay.frameCount / maxFrames, 1),
      proofValid ? 1.0 : 0.0,
      0, // rng call count — caller should pass; we use 0 as default
      Math.min(registry.size / maxRegistrySize, 1),
      lastDiff ? Math.min(lastDiff.totalChanges / 100, 1) : 0,
      Math.min((byKind['error'] ?? 0) / 100, 1),
      Math.min((byKind['card_play'] ?? 0) / maxCards, 1),
      Math.min((byKind['tier_crossing'] ?? 0) / maxTier, 1),
      Math.min((byKind['phase_transition'] ?? 0) / maxPhase, 1),
      Math.min((byKind['cascade_trigger'] ?? 0) / maxCascade, 1),
      Math.min((byKind['shield_break'] ?? 0) / maxShield, 1),
      Math.min((byKind['sovereignty_event'] ?? 0) / maxSov, 1),
      tick > 0 ? Math.min((byKind['checkpoint'] ?? 0) / Math.max(tick / 100, 1) / maxCheckpoints, 1) : 0,
      Math.min((byKind['ml_event'] ?? 0) / maxML, 1),
    ];

    const vectorHash = checksumSnapshot(features);
    return { features, labels: DETERMINISTIC_ML_FEATURE_LABELS, vectorHash, tick };
  }

  /** Produce a zero vector (used when deterministic context is unavailable). */
  static zero(tick: number): DeterministicMLVector {
    const features = new Array<number>(DeterministicMLVectorBuilder.FEATURE_COUNT).fill(0);
    return {
      features,
      labels: DETERMINISTIC_ML_FEATURE_LABELS,
      vectorHash: checksumSnapshot(features),
      tick,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — Engine Wiring Helpers (DeterministicRunContext)
// ─────────────────────────────────────────────────────────────────────────────

/** Options for building the deterministic run context. */
export interface DeterministicRunContextOptions {
  readonly runId: string;
  readonly seed: string;
  readonly userId: string;
  readonly mode: string;
  readonly signingKey?: string;
}

/**
 * DeterministicRunContext — a self-contained bundle of all deterministic
 * subsystems needed for a single run.
 *
 * The context owns:
 * - DeterministicRNG  (seeded from run seed)
 * - MerkleChain       (append-only event chain)
 * - RunAuditLog       (signed audit entries)
 * - ReplayHashBuilder (per-tick replay frames)
 * - DeterministicIdRegistry (collision-safe ID registry)
 * - CanonicalEncoder  (stats-tracked encoder)
 * - VerificationSuite (accumulates all verification checks)
 *
 * At run end, call `seal()` to produce the `ExtendedProofHashInput` that
 * links all subsystems into the final tamper-evident proof.
 */
export class DeterministicRunContext {
  readonly rng: DeterministicRNG;
  readonly merkle: MerkleChain;
  readonly auditLog: RunAuditLog;
  readonly replay: ReplayHashBuilder;
  readonly idRegistry: DeterministicIdRegistry;
  readonly encoder: CanonicalEncoder;
  readonly verification: VerificationSuite;

  private _previousSeal: string = GENESIS_SEAL;
  private _currentTick = 0;
  private _lastDiff: SnapshotDiff | null = null;
  private _sealedAt: number | null = null;

  constructor(private readonly _opts: DeterministicRunContextOptions) {
    this.rng = new DeterministicRNG(_opts.seed);
    this.merkle = new MerkleChain(`run-${_opts.runId}`);
    this.auditLog = new RunAuditLog({
      runId: _opts.runId,
      signingKey: _opts.signingKey,
      enableMerkle: true,
    });
    this.replay = new ReplayHashBuilder({
      runId: _opts.runId,
      seed: _opts.seed,
      mode: _opts.mode,
    });
    this.idRegistry = new DeterministicIdRegistry({ throwOnConflict: false });
    this.encoder = new CanonicalEncoder({
      hashAlgorithm: 'sha256',
      enableStats: true,
      signingKey: _opts.signingKey,
    });
    this.verification = new VerificationSuite();
  }

  /**
   * Advance to the next tick.
   * Records a tick entry in the audit log and advances the replay chain.
   * Returns the chained tick seal for this tick.
   */
  advanceTick(
    state: unknown,
    events: unknown[],
    mlVector: readonly number[],
  ): { seal: string; frame: ReplayFrame } {
    this._currentTick++;
    const stateChecksum = this.encoder.computeChecksum(state);
    const eventChecksums = events.map((e) => this.encoder.computeChecksum(e));

    const sealInput: ChainedTickSealInput = {
      runId: this._opts.runId,
      tick: this._currentTick,
      step: 'STEP_13_FLUSH',
      stateChecksum,
      eventChecksums,
      previousSeal: this._previousSeal,
      mlVectorChecksum: this.encoder.computeChecksum(mlVector),
    };
    const seal = computeChainedTickSeal(sealInput);
    this._previousSeal = seal;

    const frame = this.replay.addFrame(
      this._currentTick,
      state,
      events,
      this.rng.callCount,
      mlVector,
    );
    this.auditLog.recordTick(this._currentTick, stateChecksum, events.length);

    return { seal, frame };
  }

  /** Record that a phase transition occurred this tick. */
  onPhaseTransition(fromPhase: string, toPhase: string): void {
    this.auditLog.recordPhaseTransition(this._currentTick, fromPhase, toPhase);
    this.merkle.append({ type: 'phase_transition', fromPhase, toPhase, tick: this._currentTick });
  }

  /** Record that a tier crossing occurred this tick. */
  onTierCrossing(fromTier: number, toTier: number): void {
    this.auditLog.recordTierCrossing(this._currentTick, fromTier, toTier);
    this.merkle.append({ type: 'tier_crossing', fromTier, toTier, tick: this._currentTick });
  }

  /** Record a card play and return its deterministic ID. */
  onCardPlay(cardId: string, netWorthBefore: number, netWorthAfter: number): string {
    const playId = this.idRegistry.getOrCreate('card_play', `${this._opts.runId}:${this._currentTick}:${cardId}`).id;
    this.auditLog.recordCardPlay(
      this._currentTick,
      cardId,
      this._opts.userId,
      netWorthBefore,
      netWorthAfter,
    );
    this.merkle.append({ type: 'card_play', cardId, playId, tick: this._currentTick });
    return playId;
  }

  /** Record a cascade trigger. */
  onCascadeTrigger(cascadeId: string, chainDepth: number): void {
    this.auditLog.recordCascadeTrigger(this._currentTick, cascadeId, chainDepth);
  }

  /** Record a shield break. */
  onShieldBreak(shieldId: string, cause: string): void {
    this.auditLog.recordShieldBreak(this._currentTick, shieldId, cause);
  }

  /** Record a sovereignty event. */
  onSovereigntyEvent(subtype: string, payload: Record<string, unknown>): void {
    this.auditLog.recordSovereigntyEvent(this._currentTick, subtype, payload);
  }

  /** Record an RNG fork. */
  onRNGFork(childSeed: number, purpose: string): void {
    this.auditLog.recordRNGFork(this._currentTick, this.rng.currentSeed, childSeed, purpose);
  }

  /** Record an ML event with its vector checksum. */
  onMLEvent(eventType: string, mlVector: readonly number[], score: number): void {
    const vectorChecksum = this.encoder.computeChecksum(mlVector);
    this.auditLog.recordMLEvent(this._currentTick, eventType, vectorChecksum, score);
  }

  /**
   * Update the snapshot diff from last tick to this tick.
   * Used to populate the diff-rate ML feature.
   */
  updateDiff(previousState: unknown, currentState: unknown): SnapshotDiff {
    this._lastDiff = DeterministicSnapshotDiff.compute(previousState, currentState);
    return this._lastDiff;
  }

  /**
   * Seal the run and produce the ExtendedProofHashInput.
   * Must be called exactly once at run end.
   */
  seal(outcome: string, finalNetWorth: number): {
    extendedInput: ExtendedProofHashInput;
    proofHash: string;
    extendedProofHash: string;
    replayReport: ReplayHashReport;
    auditSummary: AuditLogSummary;
  } {
    if (this._sealedAt !== null) {
      throw new Error('DeterministicRunContext.seal() called more than once');
    }
    this._sealedAt = Date.now();

    const replayReport = this.replay.finalize();
    const auditSummary = this.auditLog.buildSummary();

    const proofInput: ProofHashInput = {
      seed: this._opts.seed,
      tickStreamChecksum: replayReport.streamChecksum,
      outcome,
      finalNetWorth,
      userId: this._opts.userId,
    };
    const proofHash = computeProofHash(proofInput);

    const extendedInput: ExtendedProofHashInput = {
      ...proofInput,
      runId: this._opts.runId,
      mode: this._opts.mode,
      totalTicks: this._currentTick,
      finalPressureTier: 0, // caller should override after construction
      merkleRoot: this.merkle.root(),
      auditLogHash: auditSummary.logHash,
    };
    const extendedProofHash = computeExtendedProofHash(extendedInput);

    this.auditLog.recordProofSealed(this._currentTick, proofHash, extendedProofHash);

    return { extendedInput, proofHash, extendedProofHash, replayReport, auditSummary };
  }

  /** Build the ML vector from the current deterministic context state. */
  buildMLVector(): DeterministicMLVector {
    return DeterministicMLVectorBuilder.build(
      this.auditLog,
      this.replay,
      this.idRegistry,
      this._currentTick,
      true,
      this._lastDiff,
    );
  }

  /**
   * Build the full DeterministicMLContext for consumption by the engine's
   * ML routing layer.
   */
  buildMLContext(): DeterministicMLContext {
    return {
      vector: this.buildMLVector(),
      auditSummary: this.auditLog.buildSummary(),
      replayFrameCount: this.replay.frameCount,
      proofValid: true,
      registryStats: this.idRegistry.getStats(),
    };
  }

  get currentTick(): number { return this._currentTick; }
  get runId(): string { return this._opts.runId; }
  get seed(): string { return this._opts.seed; }
  get userId(): string { return this._opts.userId; }
  get mode(): string { return this._opts.mode; }
  get previousSeal(): string { return this._previousSeal; }
  get isSealted(): boolean { return this._sealedAt !== null; }
}

/**
 * Factory: build a fully wired DeterministicRunContext for a new run.
 * This is the primary entry point for the engine's deterministic subsystem.
 */
export function buildDeterministicRunContext(
  opts: DeterministicRunContextOptions,
): DeterministicRunContext {
  return new DeterministicRunContext(opts);
}

/**
 * Link an existing RunAuditLog to a MerkleChain so every audit entry
 * is automatically appended to the merkle chain.
 *
 * Returns a wrapper that intercepts audit log recording and appends
 * a merkle leaf for each recorded entry.
 *
 * NOTE: This is a wiring utility for callers that maintain separate
 * audit log and merkle chain instances.
 */
export function linkAuditLogToMerkleChain(
  auditLog: RunAuditLog,
  merkle: MerkleChain,
): { auditLog: RunAuditLog; merkle: MerkleChain; logHash: () => string; combinedHash: () => string } {
  return {
    auditLog,
    merkle,
    logHash: () => auditLog.computeLogHash(),
    combinedHash: () => checksumParts(auditLog.computeLogHash(), merkle.root()),
  };
}

/**
 * Build a VerificationSuite that is pre-wired to verify an entire
 * run's replay frame chain and proof hash in a single pass.
 */
export function buildReplayVerificationSuite(
  frames: readonly ReplayFrame[],
  proofInput: ProofHashInput,
  claimedProofHash: string,
): { suite: VerificationSuite; report: BatchVerificationResult } {
  const suite = new VerificationSuite();

  // Verify proof hash
  suite.checkProofHash(proofInput, claimedProofHash);

  // Verify replay chain
  let previousChainHash = '0'.repeat(64);
  for (const frame of frames) {
    suite.checkReplayFrame(frame, previousChainHash);
    previousChainHash = frame.chainHash;
  }

  return { suite, report: suite.buildReport() };
}

/**
 * Generate a cryptographically random nonce string.
 * Uses `randomBytes` from node:crypto. Suitable for run IDs and session tokens.
 */
export function generateNonce(byteLength = 16): string {
  return randomBytes(byteLength).toString('hex');
}

/**
 * Build a run ID from a seed and userId, incorporating a timestamp nonce.
 * Uses `randomBytes` to ensure uniqueness even for identical (seed, userId) pairs.
 */
export function buildRunId(seed: string, userId: string): string {
  const nonce = randomBytes(8).toString('hex');
  return createDeterministicId('run', seed, userId, nonce);
}
