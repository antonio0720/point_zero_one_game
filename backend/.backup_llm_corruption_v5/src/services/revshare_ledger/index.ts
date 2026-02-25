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
