/**
 * Weekly Challenge Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WeeklyChallenge, WeeklyChallengeDocument } from './schemas/weekly-challenge.schema';
import { ChallengeScenario, ChallengeScenarioDocument } from '../scenarios/schemas/challenge-scenario.schema';
import { Participant, ParticipantDocument } from '../participants/schemas/participant.schema';

/**
 * Weekly Challenge Service Interface
 */
@Injectable()
export interface IWeeklyChallengeService {
  createChallenge(scenario: string, constraint?: string): Promise<WeeklyChallengeDocument>;
  getGlobalLeaderboard(): Promise<WeeklyChallengeDocument[]>;
  displayParticipantCount(): Promise<number>;
  calculateCompletionRate(): Promise<number>;
  announceWinnerAndShareMoment(winner: ParticipantDocument): Promise<void>;
}

/**
 * Weekly Challenge Service Implementation
 */
@Injectable()
export class WeeklyChallengeService implements IWeeklyChallengeService {
  constructor(
    @InjectModel(WeeklyChallenge.name) private readonly weeklyChallengeModel: Model<WeeklyChallengeDocument>,
    @InjectModel(ChallengeScenario.name) private readonly scenarioModel: Model<ChallengeScenarioDocument>,
    @InjectModel(Participant.name) private readonly participantModel: Model<ParticipantDocument>,
  ) {}

  async createChallenge(scenario: string, constraint?: string): Promise<WeeklyChallengeDocument> {
    const scenarioDoc = await this.scenarioModel.findOne({ name: scenario });
    if (!scenarioDoc) throw new Error('Invalid scenario');

    const challenge = new this.weeklyChallengeModel({
      scenarioId: scenarioDoc._id,
      constraint,
      createdAt: new Date(),
    });

    return challenge.save();
  }

  async getGlobalLeaderboard(): Promise<WeeklyChallengeDocument[]> {
    return this.weeklyChallengeModel.find().sort({ createdAt: -1 }).exec();
  }

  async displayParticipantCount(): Promise<number> {
    const participants = await this.participantModel.countDocuments();
    return participants;
  }

  async calculateCompletionRate(): Promise<number> {
    // Implement deterministic calculation based on game engine or replay data
  }

  async announceWinnerAndShareMoment(winner: ParticipantDocument): Promise<void> {
    // Implement winner announcement and share moment logic
  }
}
```

```sql
-- Weekly Challenge Schema
CREATE TABLE IF NOT EXISTS weekly_challenges (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER REFERENCES scenarios(id),
  constraint TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
);

-- Challenge Scenario Schema
CREATE TABLE IF NOT EXISTS challenge_scenarios (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE,
  -- Add other fields as needed
);

-- Participant Schema
CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE,
  -- Add other fields as needed
);
```

```bash
#!/bin/bash
set -euo pipefail

echo "Creating weekly_challenges table"
psql -f create-tables.sql

echo "Inserting data into challenge_scenarios table"
psql -f insert-data.sql
```

```yaml
# terraform.tfvars
weekly_challenge_table = "weekly_challenges"
challenge_scenario_table = "challenge_scenarios"
participant_table = "participants"

# main.tf
resource "aws_rds_db_instance" "point_zero_one_digital" {
  allocated_storage      = 20
  storage_type           = "gp2"
  engine                 = "postgres"
  engine_version         = "13.4"
  instance_class         = "db.t2.micro"
  username               = "your_username"
  password               = "your_password"
  db_name                = "point_zero_one_digital"
  skip_final_snapshot    = true
}
