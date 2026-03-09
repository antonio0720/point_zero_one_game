/**
 * UGC Ingest Service Implementation
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { Ugc, UgcVersion } from '../models/ugc';
import { Database } from '../database';

class UgcIngestImpl {
  private db: Database;
  private eventEmitter: EventEmitter;

  constructor() {
    this.db = new Database();
    this.eventEmitter = new EventEmitter();
  }

  public async submitUgc(ugc: Ugc): Promise<void> {
    // Compute content hash
    const contentHash = crypto.createHash('sha256').update(ugc.content).digest('hex');

    // Store version
    await this.db.insertUgcVersion({
      ugcId: ugc.id,
      contentHash,
      createdAt: new Date(),
    });

    // Emit UGC_SUBMITTED event
    this.eventEmitter.emit('UGC_SUBMITTED', {
      ugcId: ugc.id,
      contentHash,
    });

    // Start stage timers
    // (Assuming there's a separate service or function for managing game stages)
  }
}

export { UgcIngestImpl };
