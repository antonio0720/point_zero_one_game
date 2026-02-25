/**
 * Ladder Enumeration Hardening
 */

import { v4 as uuidv4 } from 'uuid';

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

export const createRankEntry = (userId: string, rank: number, score: number): RankEntry => ({
  id: uuidv4(),
  userId,
  rank,
  score,
  timestamp: new Date(),
});

export type PaginationToken = {
  startId?: string;
  endId?: string;
};

export const compareIdsConstantTime = (a: string, b: string): number => {
  let result = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    result |= a[i].charCodeAt(0) - b[i].charCodeAt(0);
  }
  return result;
};

export const createPaginationToken = (entries: RankEntry[]): PaginationToken => {
  const sortedEntries = [...entries].sort((a, b) => compareIdsConstantTime(a.id, b.id));
  const middleIndex = Math.floor(sortedEntries.length / 2);
  return { startId: sortedEntries[middleIndex - 1]?.id, endId: sortedEntries[middleIndex]?.id };
};

export const isValidPaginationToken = (token: PaginationToken, currentEntry: RankEntry): boolean => {
  if (!token.startId && !token.endId) return true;
  if (token.startId && token.startId > currentEntry.id) return false;
  if (token.endId && token.endId < currentEntry.id) return false;
  return true;
};

SQL:
