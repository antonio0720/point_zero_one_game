/**
 * Quarantine Routing Service for Verified Controls in Point Zero One Digital's Financial Roguelike Game
 *
 * If verification fails, quarantine entry privately and return non-accusatory user messaging with next steps.
 */

import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { VerificationService } from '../verification/verification.service';

/**
 * Quarantine Routing Service Interface
 */
export interface IQuarantineRoutingService {
  quarantine(userId: string): Promise<{ message: string; nextSteps: string[] }>;
}

/**
 * Quarantine Routing Service Implementation
 */
@Injectable()
export class QuarantineRoutingService implements IQuarantineRoutingService {
  constructor(private readonly userService: UserService, private readonly verificationService: VerificationService) {}

  async quarantine(userId: string): Promise<{ message: string; nextSteps: string[] }> {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const verificationResult = await this.verificationService.verify(user);
    if (verificationResult.isSuccess) {
      return { message: 'Verification successful!', nextSteps: [] };
    }

    // Quarantine entry privately
    await this.userService.quarantine(userId);

    // Return non-accusatory user messaging with next steps
    const { message, nextSteps } = verificationResult;
    return { message, nextSteps };
  }
}
