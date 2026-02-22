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
    INSERT INTO receipts (transaction_id, timestamp, hash)
    VALUES ($1, $2, $3)
    RETURNING id;`, [transactionId, timestamp, hash]);
  return result.rows[0].id;
}

/**
 * Verify the integrity of a given receipt by checking its hash against the stored one.
 * @param db Database instance.
 * @param receiptId ID of the receipt to verify.
 * @returns True if the receipt is valid, false otherwise.
 */
export async function verifyReceipt(db: Database, receiptId: number): Promise<boolean> {
  const result = await db.query(`SELECT hash FROM receipts WHERE id = $1;`, [receiptId]);
  const storedHash = result.rows[0].hash;
  const transactionId = await getTransactionById(db, receiptId);
  const timestamp = new Date(await getTimestampByReceiptId(db, receiptId));
  const calculatedHash = await Hash.create(transactionId + timestamp.toISOString());
  return storedHash === calculatedHash;
}

/**
 * Get the transaction ID associated with a given receipt ID.
 * @param db Database instance.
 * @param receiptId ID of the receipt to get the transaction ID for.
 * @returns The ID of the associated transaction.
 */
export async function getTransactionById(db: Database, receiptId: number): Promise<string> {
  const result = await db.query(`SELECT transaction_id FROM receipts WHERE id = $1;`, [receiptId]);
  return result.rows[0].transaction_id;
}

/**
 * Get the timestamp associated with a given receipt ID.
 * @param db Database instance.
 * @param receiptId ID of the receipt to get the timestamp for.
 * @returns The timestamp of the associated transaction.
 */
export async function getTimestampByReceiptId(db: Database, receiptId: number): Promise<Date> {
  const result = await db.query(`SELECT timestamp FROM receipts WHERE id = $1;`, [receiptId]);
  return new Date(result.rows[0].timestamp);
}

/**
 * Export the entire receipt ledger as a JSON array of receipts.
 * @param db Database instance.
 * @returns The JSON representation of the receipt ledger.
 */
export async function exportLedger(db: Database): Promise<Receipt[]> {
  const result = await db.query(`SELECT id, transaction_id, timestamp, hash FROM receipts;`);
  return result.rows.map((row) => ({
    id: row.id,
    transactionId: row.transaction_id,
    timestamp: new Date(row.timestamp),
    hash: row.hash,
  }));
}
```

```sql
-- Receipt Ledger Table
CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  transaction_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  hash VARCHAR(64) NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_receipts_transaction_id ON receipts (transaction_id);
CREATE INDEX IF NOT EXISTS idx_receipts_timestamp ON receipts (timestamp);
```

This TypeScript code defines a Receipt Ledger Integrity module for the Point Zero One Digital game. It includes functions to append new receipts, verify their integrity, get associated transaction IDs and timestamps, and export the entire ledger as a JSON array of receipts. The SQL code creates the necessary tables and indexes in the database.
