/**
 * ModerationActionsService - Handles quarantine, delist, restore, clawback actions and their evidence chains.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationAction, EvidenceChain } from './entities';

/**
 * ModerationActionsService class.
 */
@Injectable()
export class ModerationActionsService {
  constructor(
    @InjectRepository(ModerationAction)
    private moderationActionRepository: Repository<ModerationAction>,
    @InjectRepository(EvidenceChain)
    private evidenceChainRepository: Repository<EvidenceChain>,
  ) {}

  /**
   * Create a new moderation action.
   * @param {string} action - The type of the moderation action (quarantine, delist, restore, clawback).
   * @param {number[]} gameIds - The IDs of the games affected by this moderation action.
   * @param {EvidenceChain[]} evidenceChains - The evidence chains associated with this moderation action.
   */
  async createModerationAction(action: string, gameIds: number[], evidenceChains: EvidenceChain[]): Promise<ModerationAction> {
    const moderationAction = this.moderationActionRepository.create({ action });
    moderationAction.gameIds = gameIds;
    moderationAction.evidenceChains = evidenceChains;
    return this.moderationActionRepository.save(moderationAction);
  }

  /**
   * Get a moderation action by its ID.
   * @param {number} id - The ID of the moderation action to retrieve.
   */
  async getModerationActionById(id: number): Promise<ModerationAction> {
    return this.moderationActionRepository.findOne(id, { relations: ['gameIds', 'evidenceChains'] });
  }
}
```

```sql
-- ModerationActions table creation
CREATE TABLE IF NOT EXISTS moderation_actions (
  id SERIAL PRIMARY KEY,
  action VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  game_ids JSONB[] NOT NULL,
  evidence_chains_id JSONB[] REFERENCES evidence_chains(id)[]
);

-- EvidenceChains table creation
CREATE TABLE IF NOT EXISTS evidence_chains (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  evidence TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

```bash
#!/bin/bash
set -euo pipefail

echo "Creating ModerationActions table"
psql -f create_moderation_actions.sql

echo "Creating EvidenceChains table"
psql -f create_evidence_chains.sql
```

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: moderation-actions
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: moderation-actions-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: moderation-actions
      environment: production
  template:
    metadata:
      labels:
        app: moderation-actions
        environment: production
    spec:
      containers:
      - name: moderation-actions
        image: pointzeroonedigital/moderation-actions:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: moderation-actions-config
        volumeMounts:
        - name: moderation-actions-data
          mountPath: /app/data
      volumes:
      - name: moderation-actions-data
        persistentVolumeClaim:
          claimName: moderation-actions-pvc
