/**
 * Referral Cleanup and Expiry Job
 */

import { Job, QueueRunner } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';

// Configuration
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

// Job definition
export class ReferralCleanupAndExpiryJob extends Job {
  constructor() {
    super({
      name: 'referral-cleanup-and-expiry',
      cooldown: 60 * 1000, // 1 minute cooldown to prevent overloading the database
    });
  }

  async run() {
    const client = await pool.connect();

    try {
      // Expire unused invites
      await client.query('DELETE FROM invites WHERE used_at IS NULL AND expires_at < NOW()');

      // Prune stale tokens
      await client.query('DELETE FROM authentication_tokens WHERE created_at < DATE_TRUNC(\'day\', NOW())');

      console.log('Referral cleanup and expiry job completed.');
    } catch (error) {
      console.error(`Error during referral cleanup and expiry job: ${error}`);
    } finally {
      client.release();
    }
  }
}

// Queue setup
const queueRunner = new QueueRunner('default', { connection: pool });
queueRunner.add(ReferralCleanupAndExpiryJob, new ReferralCleanupAndExpiryJob());

-- Database schema for Point Zero One Digital
