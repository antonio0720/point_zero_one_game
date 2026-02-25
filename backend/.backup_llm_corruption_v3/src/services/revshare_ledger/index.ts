/**
 * Revshare Ledger Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { RevshareLedgerDocument } from './schemas/revshare-ledger.schema';

/**
 * Revshare Ledger Interface
 */
export interface IRevshareLedger extends Document {
  gameId: string;
  engagementId: string;
  period: number;
  amount: number;
  receipt?: string; // optional field for storing receipt hash
}

/**
 * Revshare Ledger Schema
 */
export const revshareLedgerSchema = {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  collection: 'revshare_ledgers',
  indexes: [
    { gameId: 1 },
    { engagementId: 1 },
    { period: 1 },
  ],
} as const;

/**
 * Revshare Ledger Model Interface
 */
export interface IRevshareLedgerModel extends Model<IRevshareLedger> {}

/**
 * Revshare Ledger Service
 */
@Injectable()
export class RevshareLedgerService {
  constructor(
    @InjectModel('RevshareLedger')
    private readonly revshareLedgerModel: IRevshareLedgerModel,
  ) {}

  // Add methods for creating, finding, updating and deleting revshare ledgers here.
}

SQL (PostgreSQL):

-- Revshare Ledger Table
CREATE TABLE IF NOT EXISTS revshare_ledgers (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(255) NOT NULL,
    engagement_id VARCHAR(255) NOT NULL,
    period INTEGER NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    receipt VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_revshare_ledgers_game_id ON revshare_ledgers (game_id);
CREATE INDEX IF NOT EXISTS idx_revshare_ledgers_engagement_id ON revshare_ledgers (engagement_id);
CREATE INDEX IF NOT EXISTS idx_revshare_ledgers_period ON revshare_ledgers (period);

Bash:

#!/bin/sh
set -euo pipefail
echo "Action: $0"

Terraform (example):

resource "aws_rds_instance" "revshare_ledger_db" {
  allocated_storage = 20
  engine            = "postgres"
  instance_class    = "db.t3.micro"
  name              = "revshare-ledger-db"
  username          = "revshare_user"
  password          = random_password.revshare_db_password.result
  skip_final_snapshot = true
}

resource "random_password" "revshare_db_password" {
  length  = 16
  special = false
}
