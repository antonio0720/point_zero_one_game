/**
 * Aggregate Rollups Service for Curriculum Measurement
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Cohort entity
 */
export class Cohort {
  id: number;
  scenarioId: number;
  packId: number;
  createdAt: Date;
}

/**
 * Scenario entity
 */
export class Scenario {
  id: number;
  name: string;
  cohorts: Cohort[];
}

/**
 * Pack entity
 */
export class Pack {
  id: number;
  name: string;
  scenarios: Scenario[];
}

/**
 * GameEvent entity
 */
export class GameEvent {
  id: number;
  cohortId: number;
  survival: boolean;
  failureMode: string;
  improvementDelta: number;
  createdAt: Date;
}

/**
 * AggregateRollupsService class
 */
@Injectable()
export class AggregateRollupsService {
  constructor(
    @InjectRepository(Cohort) private cohortRepository: Repository<Cohort>,
    @InjectRepository(Scenario) private scenarioRepository: Repository<Scenario>,
    @InjectRepository(Pack) private packRepository: Repository<Pack>,
    @InjectRepository(GameEvent) private gameEventRepository: Repository<GameEvent>,
  ) {}

  /**
   * Aggregate survival rates, failure modes, improvement deltas per cohort/scenario/pack
   */
  async aggregateRollups(): Promise<void> {
    // Implement the logic for aggregating rollups here
  }
}
```

```sql
-- Cohort table
CREATE TABLE IF NOT EXISTS cohorts (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id),
  pack_id INTEGER NOT NULL REFERENCES packs(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE (scenario_id, pack_id)
);

-- Scenario table
CREATE TABLE IF NOT EXISTS scenarios (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cohorts INTEGER[] NOT NULL,
  UNIQUE (name)
);

-- Pack table
CREATE TABLE IF NOT EXISTS packs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  scenarios INTEGER[] NOT NULL,
  UNIQUE (name)
);

-- GameEvent table
CREATE TABLE IF NOT EXISTS game_events (
  id SERIAL PRIMARY KEY,
  cohort_id INTEGER NOT NULL REFERENCES cohorts(id),
  survival BOOLEAN NOT NULL,
  failure_mode VARCHAR(255) NOT NULL,
  improvement_delta NUMERIC(10, 4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
);
```

```bash
#!/bin/bash
set -euo pipefail

echo "Aggregating rollups..."
./node_modules/.bin/ts-node backend/src/services/curriculum/measurement/aggregate_rollups.ts

echo "Rollups aggregated successfully."
```

```yaml
data:
  cohorts: []
  scenarios:
    - id: 1
      name: Scenario 1
      cohorts: []
    - id: 2
      name: Scenario 2
      cohorts: []
  packs:
    - id: 1
      name: Pack 1
      scenarios: [1, 2]
    - id: 2
      name: Pack 2
      scenarios: []
