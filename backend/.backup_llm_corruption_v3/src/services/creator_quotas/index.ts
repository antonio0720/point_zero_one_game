/**
 * Quotas and Burst Grants Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Quota entity.
 */
export class Quota {
  id: number;
  playerId: number;
  resource: string;
  limit: number;
  burstLimit: number;
  createdAt: Date;
}

/**
 * Burst Grant entity.
 */
export class BurstGrant {
  id: number;
  quotaId: number;
  playerId: number;
  resource: string;
  amount: number;
  grantedAt: Date;
}

/**
 * Quotas and burst grants repository.
 */
@Injectable()
export class CreatorQuotasService {
  constructor(
    @InjectRepository(Quota)
    private readonly quotaRepository: Repository<Quota>,
    @InjectRepository(BurstGrant)
    private readonly burstGrantRepository: Repository<BurstGrant>,
  ) {}

  // Methods for creating, updating, and deleting quotas and burst grants.
}

-- Quotas table
CREATE TABLE IF NOT EXISTS quotas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  player_id INT NOT NULL,
  resource VARCHAR(255) NOT NULL,
  limit DECIMAL(19, 8) NOT NULL,
  burst_limit DECIMAL(19, 8) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
);

-- Burst Grants table
CREATE TABLE IF NOT EXISTS burst_grants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quota_id INT NOT NULL,
  player_id INT NOT NULL,
  resource VARCHAR(255) NOT NULL,
  amount DECIMAL(19, 8) NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quota_id) REFERENCES quotas (id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
);

#!/bin/bash
set -euo pipefail

echo "Creating quotas and burst grants tables"
psql -f sql/schema.sql

echo "Running migrations for other tables"
# Add other migration commands here

data:
  creator_quotas:
    type: object
    properties:
      playerId:
        type: integer
      resource:
        type: string
      limit:
        type: number
      burstLimit:
        type: number
      createdAt:
        type: string
    required:
      - playerId
      - resource
      - limit
      - burstLimit
