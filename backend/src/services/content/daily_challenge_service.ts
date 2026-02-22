/**
 * Daily Challenge Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DailyChallengeDocument, DailyChallenge } from './schemas/daily-challenge.schema';

/**
 * Daily Challenge Service Interface
 */
@Injectable()
export interface IDailyChallengeService {
  createDailyChallenge(seed: number): Promise<DailyChallengeDocument>;
  getGlobalCompletionRate(): Promise<number>;
  getLeaderboard(): Promise<DailyChallengeDocument[]>;
}

/**
 * Daily Challenge Service Implementation
 */
@Injectable()
export class DailyChallengeService implements IDailyChallengeService {
  constructor(
    @InjectModel('DailyChallenge') private readonly dailyChallengeModel: Model<DailyChallengeDocument>,
  ) {}

  async createDailyChallenge(seed: number): Promise<DailyChallengeDocument> {
    const challenge = new this.dailyChallengeModel({ seed });
    await challenge.save();
    return challenge;
  }

  async getGlobalCompletionRate(): Promise<number> {
    const totalPlayers = await this.dailyChallengeModel.countDocuments();
    const completedChallenges = await this.dailyChallengeModel.countDocuments({ completed: true });
    return (completedChallenges / totalPlayers) * 100;
  }

  async getLeaderboard(): Promise<DailyChallengeDocument[]> {
    return this.dailyChallengeModel.find().sort('-completionRate').exec();
  }
}

/**
 * Daily Challenge Schema
 */
const dailyChallengeSchema = new mongoose.Schema({
  seed: Number,
  scenario: String,
  completed: Boolean,
  completionRate: Number,
});

dailyChallengeSchema.index({ seed: 1 }, { unique: true });
dailyChallengeSchema.index({ completed: 1 }, { sparse: true });

export const DailyChallenge = dailyChallengeSchema;
```

SQL (PostgreSQL):

```sql
-- Daily Challenge Table
CREATE TABLE IF NOT EXISTS daily_challenges (
    id SERIAL PRIMARY KEY,
    seed INTEGER NOT NULL UNIQUE,
    scenario TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    completion_rate DECIMAL(10,2) DEFAULT 0
);
```

Bash (example script for creating table):

```bash
#!/bin/sh
set -euo pipefail

echo "Creating daily_challenges table"
psql -U your_user -d your_database -f create_table.sql
