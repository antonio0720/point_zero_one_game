/**
 * Billing Service for Revenue Share Payouts
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { RevsharePayout, RevsharePayoutDocument } from './revshare-payout.schema';

/**
 * Revenue Share Payout Interface
 */
export interface IRevsharePayout extends RevsharePayoutDocument {}

/**
 * Revenue Share Payout Model
 */
@Injectable()
export class RevsharePayoutsService {
  constructor(
    @InjectModel(RevsharePayout.name) private readonly model: Model<IRevsharePayout>,
  ) {}

  /**
   * Create a new revenue share payout
   * @param dealId - The ID of the associated deal
   * @param brokerId - The ID of the associated broker
   * @param schedule - The payout schedule (e.g. 'monthly', 'quarterly')
   * @returns The created revenue share payout
   */
  async create(dealId: string, brokerId: string, schedule: string): Promise<IRevsharePayout> {
    const payout = new this.model({ deal_id: dealId, broker_id: brokerId, schedule });
    return payout.save();
  }

  /**
   * Get a revenue share payout by ID
   * @param id - The ID of the revenue share payout
   * @returns The found revenue share payout or null if not found
   */
  async findOne(id: string): Promise<IRevsharePayout | null> {
    return this.model.findById(id).exec();
  }

  /**
   * Update a revenue share payout by ID
   * @param id - The ID of the revenue share payout to update
   * @param updates - The updates to apply
   * @returns The updated revenue share payout or null if not found
   */
  async update(id: string, updates: Partial<IRevsharePayout>): Promise<IRevsharePayout | null> {
    return this.model.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  /**
   * Delete a revenue share payout by ID
   * @param id - The ID of the revenue share payout to delete
   * @returns The deleted revenue share payout or null if not found
   */
  async remove(id: string): Promise<IRevsharePayout | null> {
    return this.model.findByIdAndDelete(id).exec();
  }
}

/**
 * Revenue Share Payout Schema
 */
export const RevsharePayoutSchema = new Mongoose.Schema({
  deal_id: { type: String, required: true, ref: 'Deal' },
  broker_id: { type: String, required: true, ref: 'Broker' },
  schedule: { type: String, enum: ['monthly', 'quarterly'], required: true },
});
RevsharePayoutSchema.index({ deal_id: 1, broker_id: 1 }, { unique: true });
export const RevsharePayout = RevsharePayoutSchema.options({ strict: true, toJSON: { virtuals: true } });

SQL (PostgreSQL):

CREATE TABLE IF NOT EXISTS revenue_share_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  broker_id UUID NOT NULL REFERENCES brokers(id),
  schedule VARCHAR(255) NOT NULL CHECK (schedule IN ('monthly', 'quarterly')),
  UNIQUE (deal_id, broker_id)
);

Terraform:

resource "postgresql_table" "revshare_payouts" {
  name = "revenue_share_payouts"
  schema = postgresql_schema.public

  columns = [
    { name = "id"; type = "uuid"; is_primary_key = true },
    { name = "deal_id"; type = "uuid"; references = { table = "deals", column = "id" } },
    { name = "broker_id"; type = "uuid"; references = { table = "brokers", column = "id" } },
    { name = "schedule"; type = "varchar(255)" },
  ]

  unique_indexes = [
    { columns = ["deal_id", "broker_id"] },
  ]

  check_constraints = [
    { name = "check_revshare_payout_schedule", expression = "schedule IN ('monthly', 'quarterly')" }
  ]
}

Bash (example script for creating the table):

#!/bin/sh
set -euo pipefail

psql -h localhost -U postgres -f ./migrations/20230315_create_revenue_share_payouts.sql
