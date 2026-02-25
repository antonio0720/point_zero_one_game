// backend/src/services/referrals/index.ts

import { v4 as uuidv4 } from 'uuid';
import { Referral, ReferralStatus } from './models/Referral';
import { User } from '../users/models/User';

export const referralService = {
  async createInvite(userId: string): Promise<string> {
    const referralId = uuidv4();
    await db.query(
      `
