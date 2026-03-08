/**
 * Publish Receipts
 * backend/src/content_ops/pack_authoring/publish_receipts.ts
 *
 * Deterministic publish receipt management with conflict detection.
 */

import { createHash, timingSafeEqual } from 'crypto';

export interface PublishReceipt {
  contentHash: string;
  versionPinSet: string[];
  publishActor: string;
  timestamp: Date;
}

export interface PublishReceiptsRepository {
  save(receipt: PublishReceipt): Promise<void>;
  getLatestByContentHash(contentHash: string): Promise<PublishReceipt | null>;
}

export class PublishConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishConflictError';
  }
}

export function normalizeVersionPinSet(versionPinSet: string[]): string[] {
  return Array.from(
    new Set(
      versionPinSet
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ).sort();
}

export function hashVersionPinSet(versionPinSet: string[]): string {
  const normalized = normalizeVersionPinSet(versionPinSet).join('|');
  return createHash('sha256').update(normalized).digest('hex');
}

function safeEqualHex(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function isSameReceipt(
  left: PublishReceipt,
  right: PublishReceipt,
): boolean {
  return (
    left.contentHash === right.contentHash &&
    left.publishActor === right.publishActor &&
    safeEqualHex(
      hashVersionPinSet(left.versionPinSet),
      hashVersionPinSet(right.versionPinSet),
    )
  );
}

export class PublishReceiptsService {
  private readonly repository: PublishReceiptsRepository;
  private readonly now: () => Date;

  constructor(
    repository: PublishReceiptsRepository,
    now: () => Date = () => new Date(),
  ) {
    this.repository = repository;
    this.now = now;
  }

  public async assertNoConflict(
    contentHash: string,
    versionPinSet: string[],
  ): Promise<void> {
    const currentReceipt =
      await this.repository.getLatestByContentHash(contentHash);

    if (!currentReceipt) {
      return;
    }

    const currentPinHash = hashVersionPinSet(currentReceipt.versionPinSet);
    const incomingPinHash = hashVersionPinSet(versionPinSet);

    if (!safeEqualHex(currentPinHash, incomingPinHash)) {
      throw new PublishConflictError(
        'Publish conflict detected: contentHash already exists with a different version pin set',
      );
    }
  }

  public async publish(
    contentHash: string,
    versionPinSet: string[],
    publishActor: string,
  ): Promise<PublishReceipt> {
    await this.assertNoConflict(contentHash, versionPinSet);

    const normalizedPinSet = normalizeVersionPinSet(versionPinSet);
    const currentReceipt =
      await this.repository.getLatestByContentHash(contentHash);

    const candidate: PublishReceipt = {
      contentHash,
      versionPinSet: normalizedPinSet,
      publishActor,
      timestamp: this.now(),
    };

    if (currentReceipt && isSameReceipt(currentReceipt, candidate)) {
      return currentReceipt;
    }

    await this.repository.save(candidate);
    return candidate;
  }
}