/**
 * Receipt Ledger Integrity Module
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/receipt_ledger_integrity.ts
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type ReceiptIntegrityStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'QUARANTINED'
  | 'INTEGRITY_VIOLATION';

export interface ReceiptLedgerPayload {
  readonly eventName: string;
  readonly runId: string;
  readonly userId: string;
  readonly tick: number;
  readonly sequence: number;
  readonly contentVersion: string;
  readonly eventAtMs: number;
  readonly fields: Readonly<Record<string, unknown>>;
}

export interface ReceiptLedgerEntry {
  readonly entryId: string;
  readonly prevHash: string | null;
  readonly payloadHash: string;
  readonly entryHash: string;
  readonly payload: ReceiptLedgerPayload;
}

export interface ReceiptBatch {
  readonly batchId: string;
  readonly runId: string;
  readonly fromSequence: number;
  readonly toSequence: number;
  readonly entryHashes: readonly string[];
  readonly merkleRoot: string;
  readonly chainHead: string;
  readonly issuedAtMs: number;
  readonly signature: string;
}

export interface ReceiptBatchVerification {
  readonly valid: boolean;
  readonly status: ReceiptIntegrityStatus;
  readonly failures: readonly string[];
}

export interface ReceiptMerkleProof {
  readonly leafHash: string;
  readonly leafIndex: number;
  readonly siblings: ReadonlyArray<{
    readonly side: 'LEFT' | 'RIGHT';
    readonly hash: string;
  }>;
  readonly merkleRoot: string;
}

const MAX_EVENT_NAME_LENGTH = 96;
const MAX_RUN_ID_LENGTH = 128;
const MAX_USER_ID_LENGTH = 128;
const MAX_CONTENT_VERSION_LENGTH = 64;
const MAX_FAILURES = 256;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/gu;
const MULTISPACE = /\s+/gu;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function hmacSha256(secret: string, input: string): string {
  return createHmac('sha256', secret).update(input).digest('hex');
}

function compareHex(lhs: string, rhs: string): boolean {
  if (lhs.length !== rhs.length || lhs.length === 0 || lhs.length % 2 !== 0) {
    return false;
  }

  try {
    const left = Buffer.from(lhs, 'hex');
    const right = Buffer.from(rhs, 'hex');

    if (left.length !== right.length) {
      return false;
    }

    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function normalizeText(value: string, maxLength: number): string {
  return value
    .normalize('NFKC')
    .replace(CONTROL_CHARS, ' ')
    .replace(MULTISPACE, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeInt(
  value: number,
  fieldName: string,
  min = 0,
): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return value;
}

function normalizeFields(
  fields: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...(fields ?? {}) });
}

function normalizePayload(payload: ReceiptLedgerPayload): ReceiptLedgerPayload {
  const eventName = normalizeText(payload.eventName, MAX_EVENT_NAME_LENGTH);
  const runId = normalizeText(payload.runId, MAX_RUN_ID_LENGTH);
  const userId = normalizeText(payload.userId, MAX_USER_ID_LENGTH);
  const contentVersion = normalizeText(
    payload.contentVersion,
    MAX_CONTENT_VERSION_LENGTH,
  );

  if (eventName.length === 0) {
    throw new Error('Receipt payload eventName is required.');
  }

  if (runId.length === 0) {
    throw new Error('Receipt payload runId is required.');
  }

  if (userId.length === 0) {
    throw new Error('Receipt payload userId is required.');
  }

  if (contentVersion.length === 0) {
    throw new Error('Receipt payload contentVersion is required.');
  }

  return {
    eventName,
    runId,
    userId,
    tick: normalizeInt(payload.tick, 'tick', 0),
    sequence: normalizeInt(payload.sequence, 'sequence', 0),
    contentVersion,
    eventAtMs: normalizeInt(payload.eventAtMs, 'eventAtMs', 0),
    fields: normalizeFields(payload.fields),
  };
}

function clampFailures(failures: string[]): string[] {
  if (failures.length <= MAX_FAILURES) {
    return failures;
  }

  return [
    ...failures.slice(0, MAX_FAILURES - 1),
    `failure_truncated:${failures.length - (MAX_FAILURES - 1)}`,
  ];
}

function determineVerificationStatus(
  failures: readonly string[],
): ReceiptIntegrityStatus {
  if (failures.length === 0) {
    return 'VERIFIED';
  }

  if (
    failures.some(
      (failure) =>
        failure === 'signature_mismatch' ||
        failure === 'batch_signature_malformed',
    )
  ) {
    return 'QUARANTINED';
  }

  return 'INTEGRITY_VIOLATION';
}

function validateSequentialEntries(
  entries: readonly ReceiptLedgerEntry[],
  failures: string[],
): void {
  let expectedRunId: string | null = null;
  let expectedSequence: number | null = null;

  for (let index = 0; index < entries.length; index += 1) {
    const current = entries[index]!;
    const normalizedPayload = normalizePayload(current.payload);

    if (expectedRunId === null) {
      expectedRunId = normalizedPayload.runId;
    } else if (expectedRunId !== normalizedPayload.runId) {
      failures.push(`run_id_mismatch:${current.entryId}`);
    }

    if (expectedSequence === null) {
      expectedSequence = normalizedPayload.sequence;
    } else {
      const nextExpectedSequence = expectedSequence + 1;
      if (normalizedPayload.sequence !== nextExpectedSequence) {
        failures.push(`sequence_gap_or_reorder:${current.entryId}`);
      }
      expectedSequence = normalizedPayload.sequence;
    }

    const recomputedEntryId = `${normalizedPayload.runId}:${normalizedPayload.sequence}`;
    if (current.entryId !== recomputedEntryId) {
      failures.push(`entry_id_mismatch:${current.entryId}`);
    }

    if (index > 0) {
      const previous = entries[index - 1]!;
      if (normalizedPayload.tick < previous.payload.tick) {
        failures.push(`tick_regression:${current.entryId}`);
      }
      if (normalizedPayload.eventAtMs < previous.payload.eventAtMs) {
        failures.push(`event_time_regression:${current.entryId}`);
      }
    }
  }
}

export function canonicalizeReceiptPayload(payload: ReceiptLedgerPayload): string {
  return stableStringify(normalizePayload(payload));
}

export function createReceiptLedgerEntry(input: {
  readonly prevHash: string | null;
  readonly payload: ReceiptLedgerPayload;
}): ReceiptLedgerEntry {
  const payload = normalizePayload(input.payload);
  const prevHash = input.prevHash ?? null;
  const payloadHash = sha256(canonicalizeReceiptPayload(payload));
  const entryHash = sha256(
    stableStringify({
      prevHash,
      payloadHash,
      runId: payload.runId,
      sequence: payload.sequence,
      tick: payload.tick,
    }),
  );

  return {
    entryId: `${payload.runId}:${payload.sequence}`,
    prevHash,
    payloadHash,
    entryHash,
    payload,
  };
}

export function verifyReceiptLedgerChain(
  entries: readonly ReceiptLedgerEntry[],
): ReceiptBatchVerification {
  const failures: string[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const current = entries[index]!;
    const expectedPayloadHash = sha256(canonicalizeReceiptPayload(current.payload));

    if (current.payloadHash !== expectedPayloadHash) {
      failures.push(`payload_hash_mismatch:${current.entryId}`);
    }

    const expectedPrev =
      index === 0 ? null : entries[index - 1]!.entryHash;

    if (current.prevHash !== expectedPrev) {
      failures.push(`prev_hash_mismatch:${current.entryId}`);
    }

    const expectedEntryHash = sha256(
      stableStringify({
        prevHash: current.prevHash,
        payloadHash: current.payloadHash,
        runId: current.payload.runId,
        sequence: current.payload.sequence,
        tick: current.payload.tick,
      }),
    );

    if (current.entryHash !== expectedEntryHash) {
      failures.push(`entry_hash_mismatch:${current.entryId}`);
    }
  }

  validateSequentialEntries(entries, failures);

  const finalFailures = clampFailures(failures);

  return {
    valid: finalFailures.length === 0,
    status: determineVerificationStatus(finalFailures),
    failures: finalFailures,
  };
}

export function buildMerkleRoot(hashes: readonly string[]): string {
  if (hashes.length === 0) {
    return sha256('');
  }

  let layer = [...hashes];

  while (layer.length > 1) {
    const next: string[] = [];

    for (let index = 0; index < layer.length; index += 2) {
      const left = layer[index]!;
      const right = layer[index + 1] ?? left;
      next.push(sha256(`${left}${right}`));
    }

    layer = next;
  }

  return layer[0]!;
}

export function buildReceiptMerkleProof(
  hashes: readonly string[],
  leafIndex: number,
): ReceiptMerkleProof {
  if (hashes.length === 0) {
    throw new Error('Cannot build a Merkle proof for an empty hash list.');
  }

  if (!Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= hashes.length) {
    throw new Error('Invalid Merkle proof leaf index.');
  }

  const siblings: Array<{ side: 'LEFT' | 'RIGHT'; hash: string }> = [];
  let currentIndex = leafIndex;
  let layer = [...hashes];

  while (layer.length > 1) {
    const isRightNode = currentIndex % 2 === 1;
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
    const siblingHash = layer[siblingIndex] ?? layer[currentIndex]!;

    siblings.push({
      side: isRightNode ? 'LEFT' : 'RIGHT',
      hash: siblingHash,
    });

    const next: string[] = [];

    for (let index = 0; index < layer.length; index += 2) {
      const left = layer[index]!;
      const right = layer[index + 1] ?? left;
      next.push(sha256(`${left}${right}`));
    }

    layer = next;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    leafHash: hashes[leafIndex]!,
    leafIndex,
    siblings,
    merkleRoot: layer[0]!,
  };
}

export function verifyReceiptMerkleProof(
  proof: ReceiptMerkleProof,
): boolean {
  let computed = proof.leafHash;

  for (const sibling of proof.siblings) {
    computed =
      sibling.side === 'LEFT'
        ? sha256(`${sibling.hash}${computed}`)
        : sha256(`${computed}${sibling.hash}`);
  }

  return computed === proof.merkleRoot;
}

export function createReceiptBatch(
  entries: readonly ReceiptLedgerEntry[],
  secret: string,
  issuedAtMs = Date.now(),
): ReceiptBatch {
  if (entries.length === 0) {
    throw new Error('Cannot create a receipt batch with zero entries.');
  }

  const chainVerification = verifyReceiptLedgerChain(entries);

  if (!chainVerification.valid) {
    throw new Error(
      `Cannot create receipt batch from invalid ledger chain: ${chainVerification.failures.join(', ')}`,
    );
  }

  const first = entries[0]!;
  const last = entries[entries.length - 1]!;
  const entryHashes = entries.map((entry) => entry.entryHash);
  const merkleRoot = buildMerkleRoot(entryHashes);

  const unsignedBatch = {
    batchId: `${first.payload.runId}:${first.payload.sequence}-${last.payload.sequence}`,
    runId: first.payload.runId,
    fromSequence: first.payload.sequence,
    toSequence: last.payload.sequence,
    entryHashes,
    merkleRoot,
    chainHead: last.entryHash,
    issuedAtMs,
  };

  return {
    ...unsignedBatch,
    signature: hmacSha256(secret, stableStringify(unsignedBatch)),
  };
}

export function verifyReceiptBatch(
  batch: ReceiptBatch,
  entries: readonly ReceiptLedgerEntry[],
  secret: string,
): ReceiptBatchVerification {
  const failures: string[] = [];
  const chain = verifyReceiptLedgerChain(entries);

  if (!chain.valid) {
    failures.push(...chain.failures);
  }

  if (entries.length === 0) {
    failures.push('empty_entry_set');
  } else {
    const first = entries[0]!;
    const last = entries[entries.length - 1]!;

    if (batch.runId !== first.payload.runId) {
      failures.push('batch_run_id_mismatch');
    }

    if (batch.fromSequence !== first.payload.sequence) {
      failures.push('batch_from_sequence_mismatch');
    }

    if (batch.toSequence !== last.payload.sequence) {
      failures.push('batch_to_sequence_mismatch');
    }

    const expectedBatchId = `${first.payload.runId}:${first.payload.sequence}-${last.payload.sequence}`;
    if (batch.batchId !== expectedBatchId) {
      failures.push('batch_id_mismatch');
    }
  }

  const entryHashes = entries.map((entry) => entry.entryHash);
  const expectedMerkle = buildMerkleRoot(entryHashes);

  if (batch.entryHashes.length !== entryHashes.length) {
    failures.push('entry_hash_length_mismatch');
  }

  for (let index = 0; index < entryHashes.length; index += 1) {
    if (batch.entryHashes[index] !== entryHashes[index]) {
      failures.push(`entry_hash_mismatch_at:${index}`);
    }
  }

  if (batch.merkleRoot !== expectedMerkle) {
    failures.push('merkle_root_mismatch');
  }

  const expectedChainHead = entries[entries.length - 1]?.entryHash ?? null;
  if (batch.chainHead !== expectedChainHead) {
    failures.push('chain_head_mismatch');
  }

  const unsignedBatch = {
    batchId: batch.batchId,
    runId: batch.runId,
    fromSequence: batch.fromSequence,
    toSequence: batch.toSequence,
    entryHashes: batch.entryHashes,
    merkleRoot: batch.merkleRoot,
    chainHead: batch.chainHead,
    issuedAtMs: batch.issuedAtMs,
  };

  const expectedSignature = hmacSha256(secret, stableStringify(unsignedBatch));

  if (!/^[0-9a-f]+$/iu.test(batch.signature) || batch.signature.length % 2 !== 0) {
    failures.push('batch_signature_malformed');
  } else if (!compareHex(batch.signature, expectedSignature)) {
    failures.push('signature_mismatch');
  }

  const finalFailures = clampFailures(failures);

  return {
    valid: finalFailures.length === 0,
    status: determineVerificationStatus(finalFailures),
    failures: finalFailures,
  };
}

export class ReceiptLedger {
  private readonly entries: ReceiptLedgerEntry[] = [];

  public append(payload: ReceiptLedgerPayload): ReceiptLedgerEntry {
    const normalizedPayload = normalizePayload(payload);

    if (this.entries.length > 0) {
      const last = this.entries[this.entries.length - 1]!.payload;

      if (normalizedPayload.runId !== last.runId) {
        throw new Error('Receipt ledger runId cannot change within one ledger.');
      }

      if (normalizedPayload.sequence !== last.sequence + 1) {
        throw new Error('Receipt ledger sequence must increase by exactly 1.');
      }

      if (normalizedPayload.tick < last.tick) {
        throw new Error('Receipt ledger tick cannot regress.');
      }

      if (normalizedPayload.eventAtMs < last.eventAtMs) {
        throw new Error('Receipt ledger eventAtMs cannot regress.');
      }
    }

    const prevHash =
      this.entries.length > 0
        ? this.entries[this.entries.length - 1]!.entryHash
        : null;

    const entry = createReceiptLedgerEntry({
      prevHash,
      payload: normalizedPayload,
    });

    this.entries.push(entry);
    return entry;
  }

  public size(): number {
    return this.entries.length;
  }

  public head(): ReceiptLedgerEntry | null {
    return this.entries[this.entries.length - 1] ?? null;
  }

  public list(): readonly ReceiptLedgerEntry[] {
    return this.entries;
  }

  public listRange(fromSequence: number, toSequence: number): readonly ReceiptLedgerEntry[] {
    if (this.entries.length === 0) {
      return [];
    }

    return this.entries.filter(
      (entry) =>
        entry.payload.sequence >= fromSequence &&
        entry.payload.sequence <= toSequence,
    );
  }

  public seal(secret: string, issuedAtMs = Date.now()): ReceiptBatch {
    return createReceiptBatch(this.entries, secret, issuedAtMs);
  }

  public verify(secret: string, batch: ReceiptBatch): ReceiptBatchVerification {
    return verifyReceiptBatch(batch, this.entries, secret);
  }

  public reset(): void {
    this.entries.length = 0;
  }
}