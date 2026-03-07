/**
 * Streak Reconciliation Job
 */

import { Job, JobContext } from '../job';

interface StreakReconciliationJobData {
  userId: number;
  eventType: string;
  timestamp: Date;
}

interface StreakReconciliationJobOutput {
  reconciledEvents: Array<StreakReconciliationJobData>;
  auditReceipts: Array<string>;
}

/**
 * Nightly reconciliation for missed events, idempotent corrections, and audit receipts.
 */
export class StreakReconciliationJob extends Job {
  public async run(context: JobContext): Promise<StreakReconciliationJobOutput> {
    const { db } = context;

    // Query missed events
    const missedEvents = await db.query(`
      SELECT user_id, event_type, timestamp
      FROM missed_events;
    `);

    const reconciledEvents: StreakReconciliationJobData[] = [];
    const auditReceipts: string[] = [];

    for (const { userId, eventType, timestamp } of missedEvents) {
      // Reconcile the event and generate an audit receipt
      const reconciledEvent = await this.reconcile(db, userId, eventType, timestamp);
      reconciledEvents.push(reconciledEvent);
      auditReceipts.push(this.generateAuditReceipt(reconciledEvent));
    }

    // Save the reconciled events and audit receipts to the database
    await db.query(`
