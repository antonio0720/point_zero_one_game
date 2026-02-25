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

CREATE TABLE IF NOT EXISTS rank_entries (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  rank INT NOT NULL,
  score BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_rank_entries_userId ON rank_entries (userId);
CREATE INDEX IF NOT EXISTS idx_rank_entries_id ON rank_entries (id);

Bash:

#!/bin/sh
set -euo pipefail
echo "Executing action"
command

YAML:

resource "aws_rds_cluster" "point_zero_one_digital" {
  cluster_identifier = "point-zero-one-digital"
  engine = "postgres"
  master_username = "master_user"
  master_password = "master_password"
  skip_final_snapshot = true

  tags = {
    Name = "Point Zero One Digital"
  }
}
