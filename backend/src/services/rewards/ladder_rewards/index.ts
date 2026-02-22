/**
 * LadderRewards service for participation and prestige cosmetic unlocks.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * LadderReward entity representing a reward for participating in or achieving prestige on the ladder.
 */
export class LadderReward {
  id: number;
  itemId: number;
  participationRankThreshold: number;
  prestigeRankThreshold: number;
}

/**
 * LadderRewards service interface for interacting with the LadderReward entity.
 */
export interface ILadderRewardsService {
  findAll(): Promise<LadderReward[]>;
  findById(id: number): Promise<LadderReward | null>;
}

/**
 * LadderRewards service implementation.
 */
@Injectable()
export class LadderRewardsService implements ILadderRewardsService {
  constructor(
    @InjectRepository(LadderReward)
    private readonly ladderRewardRepository: Repository<LadderReward>,
  ) {}

  async findAll(): Promise<LadderReward[]> {
    return this.ladderRewardRepository.find();
  }

  async findById(id: number): Promise<LadderReward | null> {
    return this.ladderRewardRepository.findOneBy({ id });
  }
}
```

SQL (PostgreSQL):

```sql
-- Ladder Rewards table schema
CREATE TABLE IF NOT EXISTS ladder_rewards (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL,
  participation_rank_threshold INTEGER NOT NULL,
  prestige_rank_threshold INTEGER NOT NULL,
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_ladder_rewards_item_id ON ladder_rewards (item_id);
```

Bash:

```bash
#!/bin/sh
set -euo pipefail

echo "Creating table ladder_rewards"
psql -f sql/ladder_rewards.sql
