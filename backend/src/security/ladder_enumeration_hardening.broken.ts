/**
 * Ladder Enumeration Hardening
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/ladder_enumeration_hardening.ts
 */

import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

const PAGINATION_TOKEN_VERSION = 1;
const DEFAULT_RANK_ENTRY_VERSION = 1;
const MAX_USER_ID_LENGTH = 128;

export type RankEntry = {
  id: string;
  userId: string;
  rank: number;
  score: number;
  timestamp: Date;
};

export interface RankEntryDocument extends RankEntry {
  version: number;
}

export type PaginationToken = {
  version: number;
  startId?: string;
  endId?: string;
  cursorId?: string | null;
  issuedAtMs: number;
  nonce: string;
  scopeHash: string;
};

export type PublicRankEntry = {
  id: string;
  rank: number;
  score: number;
  timestamp: string;
  displayUserId: string;
  isOwner: boolean;
};

export interface RankWindow {
  entries: RankEntryDocument[];
  token: PaginationToken;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function normalizeIdentifier(input: string): string {
  return input.normalize('NFKC').trim();
}

function normalizeFiniteInteger(input: number, fallback = 0): number {
  if (!Number.isFinite(input)) {
    return fallback;
  }

  return Math.trunc(input);
}

function normalizeTimestamp(input: Date): Date {
  const value = input instanceof Date ? input : new Date(input);
  const epoch = value.getTime();

  if (!Number.isFinite(epoch)) {
    return new Date(0);
  }

  return new Date(epoch);
}

function normalizeRankEntry(
  entry: RankEntry | RankEntryDocument,
): RankEntryDocument {
  return {
    id: normalizeIdentifier(entry.id),
    userId: normalizeIdentifier(entry.userId).slice(0, MAX_USER_ID_LENGTH),
    rank: Math.max(1, normalizeFiniteInteger(entry.rank, 1)),
    score: normalizeFiniteInteger(entry.score, 0),
    timestamp: normalizeTimestamp(entry.timestamp),
    version:
      'version' in entry && Number.isFinite(entry.version)
        ? Math.max(1, Math.trunc(entry.version))
        : DEFAULT_RANK_ENTRY_VERSION,
  };
}

function buildPaginationScopeHash(entries: RankEntryDocument[]): string {
  if (entries.length === 0) {
    return sha256('ladder:empty');
  }

  const material = entries
    .map(
      (entry) =>
        `${entry.id}:${entry.userId}:${entry.rank}:${entry.score}:${entry.timestamp.getTime()}:${entry.version}`,
    )
    .join('|');

  return sha256(material);
}

function maskUserId(userId: string): string {
  return `player_${sha256(userId).slice(0, 12)}`;
}

export const createRankEntry = (
  userId: string,
  rank: number,
  score: number,
): RankEntry => ({
  id: uuidv4(),
  userId: normalizeIdentifier(userId).slice(0, MAX_USER_ID_LENGTH),
  rank: Math.max(1, normalizeFiniteInteger(rank, 1)),
  score: normalizeFiniteInteger(score, 0),
  timestamp: new Date(),
});

export const createRankEntryDocument = (
  entry: RankEntry,
  version = DEFAULT_RANK_ENTRY_VERSION,
): RankEntryDocument => ({
  ...entry,
  version: Math.max(1, normalizeFiniteInteger(version, DEFAULT_RANK_ENTRY_VERSION)),
});

export const compareIdsConstantTime = (a: string, b: string): number => {
  const left = normalizeIdentifier(a);
  const right = normalizeIdentifier(b);
  const maxLength = Math.max(left.length, right.length);

  let comparison = 0;
  let decided = 0;

  for (let index = 0; index < maxLength; index += 1) {
    const leftCode = index < left.length ? left.charCodeAt(index) : 0;
    const rightCode = index < right.length ? right.charCodeAt(index) : 0;

    let delta = 0;
    if (leftCode < rightCode) {
      delta = -1;
    } else if (leftCode > rightCode) {
      delta = 1;
    }

    if (decided === 0 && delta !== 0) {
      comparison = delta;
      decided = 1;
    }
  }

  return comparison;
};

export const sortRankEntriesForStableTraversal = (
  entries: Array<RankEntry | RankEntryDocument>,
): RankEntryDocument[] =>
  entries
    .map((entry) => normalizeRankEntry(entry))
    .sort((left, right) => {
      return compareIdsConstantTime(left.id, right.id);
    });

export const sortRankEntriesForLeaderboard = (
  entries: Array<RankEntry | RankEntryDocument>,
): RankEntryDocument[] =>
  entries
    .map((entry) => normalizeRankEntry(entry))
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      if (left.score !== right.score) {
        return right.score - left.score;
      }

      const leftTime = left.timestamp.getTime();
      const rightTime = right.timestamp.getTime();

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return compareIdsConstantTime(left.id, right.id);
    });

export const createPaginationToken = (
  entries: RankEntry[],
): PaginationToken => {
  const sortedEntries = sortRankEntriesForStableTraversal(entries);

  if (sortedEntries.length === 0) {
    return {
      version: PAGINATION_TOKEN_VERSION,
      issuedAtMs: Date.now(),
      nonce: uuidv4(),
      cursorId: null,
      scopeHash: sha256('ladder:empty'),
    };
  }

  const middleIndex = Math.floor((sortedEntries.length - 1) / 2);

  return {
    version: PAGINATION_TOKEN_VERSION,
    startId: sortedEntries[0]?.id,
    endId: sortedEntries[sortedEntries.length - 1]?.id,
    cursorId: sortedEntries[middleIndex]?.id ?? null,
    issuedAtMs: Date.now(),
    nonce: uuidv4(),
    scopeHash: buildPaginationScopeHash(sortedEntries),
  };
};

export const isValidPaginationToken = (
  token: PaginationToken,
  currentEntry: RankEntry,
): boolean => {
  if (token.version !== PAGINATION_TOKEN_VERSION) {
    return false;
  }

  if (!token.startId && !token.endId) {
    return true;
  }

  const currentId = normalizeIdentifier(currentEntry.id);

  if (
    token.startId &&
    compareIdsConstantTime(token.startId, token.endId ?? token.startId) > 0
  ) {
    return false;
  }

  if (token.startId && compareIdsConstantTime(currentId, token.startId) < 0) {
    return false;
  }

  if (token.endId && compareIdsConstantTime(currentId, token.endId) > 0) {
    return false;
  }

  return true;
};

export const filterEntriesByPaginationToken = (
  entries: Array<RankEntry | RankEntryDocument>,
  token: PaginationToken,
): RankEntryDocument[] =>
  sortRankEntriesForStableTraversal(entries).filter((entry) =>
    isValidPaginationToken(token, entry),
  );

export const createRankWindow = (
  entries: Array<RankEntry | RankEntryDocument>,
): RankWindow => {
  const normalized = sortRankEntriesForLeaderboard(entries);

  return {
    entries: normalized,
    token: createPaginationToken(normalized),
  };
};

export const projectPublicRankEntries = (
  entries: Array<RankEntry | RankEntryDocument>,
  viewerUserId?: string | null,
): PublicRankEntry[] =>
  sortRankEntriesForLeaderboard(entries).map((entry) => {
    const isOwner = Boolean(viewerUserId) && entry.userId === viewerUserId;

    return {
      id: entry.id,
      rank: entry.rank,
      score: entry.score,
      timestamp: entry.timestamp.toISOString(),
      displayUserId: isOwner ? entry.userId : maskUserId(entry.userId),
      isOwner,
    };
  });