/**
 * Dedupe and Hashing Service for Casual Controls in Point Zero One Digital's Financial Roguelike Game
 */

import { Hash } from 'js-sha3';

export interface Score {
  /** Unique identifier for the score submission */
  id: string;

  /** Timestamp of the score submission */
  timestamp: Date;

  /** Player's unique identifier */
  playerId: string;

  /** The game level where the score was achieved */
  level: number;

  /** The score value */
  score: number;
}

export interface IdempotencyKey {
  /** Unique identifier for the idempotency key */
  id: string;

  /** Timestamp of the idempotency key creation */
  timestamp: Date;

  /** Hash of the score submission data */
  hash: string;
}

/**
 * Generates an idempotency key for a given score submission.
 * @param score The score to generate an idempotency key for.
 * @returns An idempotency key object.
 */
export function generateIdempotencyKey(score: Score): IdempotencyKey {
  const hash = new Hash('keccak-256');
  hash.update(`${JSON.stringify(score)}`);
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    hash: hash.hex(),
  };
}

/**
 * Deduplicates score submissions based on the provided idempotency key and returns a unique score object.
 * @param scores An array of score objects to deduplicate.
 * @param idempotencyKey The idempotency key to use for deduplication.
 * @returns A unique score object or null if no matching score was found.
 */
export function dedupeScores(scores: Score[], idempotencyKey: IdempotencyKey): Score | null {
  const matchingScore = scores.find((score) => score.id === idempotencyKey.hash);
  if (matchingScore) return matchingScore;
  return null;
}
