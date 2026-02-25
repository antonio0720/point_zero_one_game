/**
 * Receipt Ledger Integrity Module
 */

import { Hash } from './hash';
import { Database } from '../database';

/**
 * Receipt structure with id, transactionId, timestamp, and hash fields.
 */
export interface Receipt {
  id: number;
  transactionId: string;
  timestamp: Date;
  hash: Hash;
}

/**
 * Append a new receipt to the ledger and return its ID.
 * @param db Database instance.
 * @param transactionId Unique identifier for the transaction.
 * @param timestamp Timestamp of the transaction.
 * @returns The ID of the newly appended receipt.
 */
export async function appendReceipt(db: Database, transactionId: string, timestamp: Date): Promise<number> {
  const hash = await Hash.create(transactionId + timestamp.toISOString());
  const result = await db.query(`
