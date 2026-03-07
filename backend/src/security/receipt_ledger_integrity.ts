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
  const left = Buffer.from(lhs, 'hex');
  const right = Buffer.from(rhs, 'hex');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function canonicalizeReceiptPayload(payload: ReceiptLedgerPayload): string {
  return stableStringify(payload);
}

export function createReceiptLedgerEntry(input: {
  readonly prevHash: string | null;
  readonly payload: ReceiptLedgerPayload;
}): ReceiptLedgerEntry {
  const payloadHash = sha256(canonicalizeReceiptPayload(input.payload));
  const entryHash = sha256(
    stableStringify({
      prevHash: input.prevHash,
      payloadHash,
      runId: input.payload.runId,
      sequence: input.payload.sequence,
      tick: input.payload.tick,
    }),
  );

  return {
    entryId: `${input.payload.runId}:${input.payload.sequence}`,
    prevHash: input.prevHash,
    payloadHash,
    entryHash,
    payload: input.payload,
  };
}

export function verifyReceiptLedgerChain(
  entries: readonly ReceiptLedgerEntry[],
): ReceiptBatchVerification {
  const failures: string[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const current = entries[index];
    const expectedPayloadHash = sha256(canonicalizeReceiptPayload(current.payload));
    if (current.payloadHash !== expectedPayloadHash) {
      failures.push(`payload_hash_mismatch:${current.entryId}`);
    }

    const expectedPrev =
      index === 0 ? null : entries[index - 1]?.entryHash ?? null;

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

  return {
    valid: failures.length === 0,
    status:
      failures.length === 0 ? 'VERIFIED' : 'INTEGRITY_VIOLATION',
    failures,
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

export function createReceiptBatch(
  entries: readonly ReceiptLedgerEntry[],
  secret: string,
  issuedAtMs = Date.now(),
): ReceiptBatch {
  if (entries.length === 0) {
    throw new Error('Cannot create a receipt batch with zero entries.');
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

  const entryHashes = entries.map((entry) => entry.entryHash);
  const expectedMerkle = buildMerkleRoot(entryHashes);
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
  if (!compareHex(batch.signature, expectedSignature)) {
    failures.push('signature_mismatch');
  }

  return {
    valid: failures.length === 0,
    status:
      failures.length === 0
        ? 'VERIFIED'
        : failures.some((failure) => failure === 'signature_mismatch')
          ? 'QUARANTINED'
          : 'INTEGRITY_VIOLATION',
    failures,
  };
}

export class ReceiptLedger {
  private readonly entries: ReceiptLedgerEntry[] = [];

  public append(payload: ReceiptLedgerPayload): ReceiptLedgerEntry {
    const prevHash = this.entries.length > 0 ? this.entries[this.entries.length - 1]!.entryHash : null;
    const entry = createReceiptLedgerEntry({ prevHash, payload });
    this.entries.push(entry);
    return entry;
  }

  public list(): readonly ReceiptLedgerEntry[] {
    return this.entries;
  }

  public seal(secret: string, issuedAtMs = Date.now()): ReceiptBatch {
    return createReceiptBatch(this.entries, secret, issuedAtMs);
  }

  public verify(secret: string, batch: ReceiptBatch): ReceiptBatchVerification {
    return verifyReceiptBatch(batch, this.entries, secret);
  }
}