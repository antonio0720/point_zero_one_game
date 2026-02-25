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
      INSERT INTO reconciled_events (user_id, event_type, timestamp)
      VALUES ${reconciledEvents.map((event) => `(${event.userId}, '${event.eventType}', '${event.timestamp.toISOString()}')`).join(',')};
    `);

    await db.query(`
      INSERT INTO audit_receipts (receipt)
      VALUES ${auditReceipts.map((receipt) => `('${receipt}')`).join(',')};
    `);

    return { reconciledEvents, auditReceipts };
  }

  private async reconcile(db: any, userId: number, eventType: string, timestamp: Date): Promise<StreakReconciliationJobData> {
    // Implement the game engine or replay logic here to determine the correct state
    // based on the provided user ID, event type, and timestamp.
    // Preserve determinism as per the spec.
  }

  private generateAuditReceipt(reconciledEvent: StreakReconciliationJobData): string {
    return `StreakReconciliationJob-${reconciledEvent.userId}-${reconciledEvent.eventType}-${reconciledEvent.timestamp.toISOString()}`;
  }
}
```

SQL:

```sql
CREATE TABLE IF NOT EXISTS missed_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_type VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS reconciled_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_type VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_receipts (
  id SERIAL PRIMARY KEY,
  receipt VARCHAR(255) UNIQUE NOT NULL
);
```

Bash:

```bash
#!/bin/sh
set -euo pipefail
echo "Starting job"
...
echo "Job completed"
