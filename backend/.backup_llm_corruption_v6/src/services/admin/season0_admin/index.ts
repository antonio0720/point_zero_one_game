/**
 * Admin service for Season0 management.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/** Membership entity. */
export class Membership {
  id: number;
  userId: number;
  seasonId: number;
  createdAt: Date;
}

/** Receipt entity. */
export class Receipt {
  id: number;
  membershipId: number;
  amount: number;
  currency: string;
  createdAt: Date;
}

/** ReferralThrottle entity. */
export class ReferralThrottle {
  id: number;
  userId: number;
  seasonId: number;
  remainingReferrals: number;
  createdAt: Date;
}

/** StampIssuanceHealth entity. */
export class StampIssuanceHealth {
  id: number;
  seasonId: number;
  totalStampsIssued: number;
  totalStampsAvailable: number;
  createdAt: Date;
}

/** AdminService interface. */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(ReferralThrottle)
    private readonly referralThrottleRepository: Repository<ReferralThrottle>,
    @InjectRepository(StampIssuanceHealth)
    private readonly stampIssuanceHealthRepository: Repository<StampIssuanceHealth>,
  ) {}

  // Admin service methods go here...
}

SQL (PostgreSQL):

