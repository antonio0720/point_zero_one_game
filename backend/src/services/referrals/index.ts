// backend/src/services/referrals/index.ts

import { v4 as uuidv4 } from 'uuid';
import { Referral, ReferralStatus } from './models/Referral';
import { User } from '../users/models/User';

export const referralService = {
  async createInvite(userId: string): Promise<string> {
    const referralId = uuidv4();
    await db.query(
      `
        INSERT INTO referrals (id, user_id, status)
        VALUES ($1, $2, 'pending')
        RETURNING id
      `,
      [referralId, userId]
    );
    return referralId;
  },

  async getCode(referralId: string): Promise<string> {
    const code = uuidv4();
    await db.query(
      `
        UPDATE referrals
        SET code = $1
        WHERE id = $2
      `,
      [code, referralId]
    );
    return code;
  },

  async acceptInvite(referralId: string, userId: string): Promise<void> {
    await db.query(
      `
        UPDATE referrals
        SET status = 'accepted'
        WHERE id = $1 AND user_id IS NULL
      `,
      [referralId]
    );

    // Update user's referral status
    await db.query(
      `
        UPDATE users
        SET referral_status = 'active'
        WHERE id = $1
      `,
      [userId]
    );
  },

  async completeInvite(referralId: string): Promise<void> {
    await db.query(
      `
        UPDATE referrals
        SET status = 'completed'
        WHERE id = $1 AND status = 'accepted'
      `,
      [referralId]
    );

    // Update user's referral status
    await db.query(
      `
        UPDATE users
        SET referral_status = 'inactive'
        WHERE id IN (
          SELECT user_id FROM referrals WHERE id = $1
        )
      `,
      [referralId]
    );
  },

  async getReferrals(userId: string): Promise<Referral[]> {
    return await db.query(
      `
        SELECT *
        FROM referrals
        WHERE user_id = $1
      `,
      [userId]
    );
  },
};

// Database schema

export const referralSchema = {
  up: (db) => {
    db.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        status VARCHAR(255) CHECK(status IN ('pending', 'accepted', 'completed')),
        code VARCHAR(255)
      );

      CREATE INDEX idx_referrals_user_id ON referrals (user_id);
    `);
  },
};

// Terraform configuration

export const referralTerraform = {
  resource: 'aws_s3_bucket',
  name: 'point-zero-one-digital-referrals',
  acl: 'private',
};
